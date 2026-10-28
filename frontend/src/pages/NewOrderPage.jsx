import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { getBytes } from 'ethers';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Lock,
  MapPin,
  Package,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { useAdmins, useProfile, useProfilesList } from '../hooks/useProfile.js';
import { getContract, humanizeError } from '../lib/contract.js';
import { formatCurrencyINR, formatWeight, shortAddress } from '../lib/format.js';
import { generateTrackingId } from '../lib/ids.js';
import {
  encryptPayload,
  generateOrderKey,
  wrapOrderKey,
  zeroize,
} from '../shared/crypto.js';
import { useToast } from '../context/ToastContext.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Callout } from '../components/ui/Callout.jsx';
import { Field, Select, TextAreaField, TextField } from '../components/ui/Form.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { SegmentedControl } from '../components/ui/SegmentedControl.jsx';
import { StatusBadge } from '../components/ui/Badges.jsx';

const STEPS = [
  { key: 'route', label: 'Route', hint: 'Sender and recipient' },
  { key: 'parcel', label: 'Parcel', hint: 'What is inside' },
  { key: 'review', label: 'Review', hint: 'Encrypt and register' },
];

const CATEGORIES = [
  'Documents',
  'Electronics',
  'Apparel',
  'Fragile',
  'Food',
  'Gifts',
  'Other',
];

const EMPTY_ADDRESS = {
  name: '',
  phone: '',
  line1: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'India',
};

function initialForm(displayName) {
  return {
    sender: { ...EMPTY_ADDRESS, name: displayName || '' },
    recipient: { ...EMPTY_ADDRESS },
    parcel: {
      description: '',
      category: 'Documents',
      weightKg: '',
      declaredValue: '',
      fragile: false,
    },
    service: 'Standard',
    instructions: '',
  };
}

function validateRoute(form, role, ownerAddress) {
  const errors = {};
  if (role === 'admin' && !ownerAddress) {
    errors.owner = 'Select the customer this order belongs to.';
  }
  const fields = [
    ['name', 'Name'],
    ['phone', 'Phone'],
    ['line1', 'Address'],
    ['city', 'City'],
    ['state', 'State'],
    ['postalCode', 'Postal code'],
    ['country', 'Country'],
  ];
  for (const party of ['sender', 'recipient']) {
    for (const [key, label] of fields) {
      const value = form[party][key]?.trim();
      if (!value) {
        errors[`${party}-${key}`] = `${label} is required.`;
      }
    }
    const phone = form[party].phone?.trim();
    if (phone && phone.replace(/[^\d]/g, '').length < 7) {
      errors[`${party}-phone`] = 'Enter a valid phone number.';
    }
    const postal = form[party].postalCode?.trim();
    if (postal && !/^[A-Za-z0-9 -]{4,10}$/.test(postal)) {
      errors[`${party}-postalCode`] = 'Enter a valid postal code.';
    }
  }
  return errors;
}

function validateParcel(form) {
  const errors = {};
  if (!form.parcel.description?.trim()) {
    errors['parcel-description'] = 'Describe the parcel.';
  }
  const weight = Number(form.parcel.weightKg);
  if (!Number.isFinite(weight) || weight <= 0) {
    errors['parcel-weightKg'] = 'Enter a weight greater than 0.';
  }
  const value = Number(form.parcel.declaredValue);
  if (!Number.isFinite(value) || value < 0) {
    errors['parcel-declaredValue'] = 'Enter a declared value of 0 or more.';
  }
  if (!CATEGORIES.includes(form.parcel.category)) {
    errors['parcel-category'] = 'Choose a category.';
  }
  return errors;
}

function focusFirstError(errors) {
  const first = Object.keys(errors)[0];
  if (!first) return;
  window.setTimeout(() => {
    const element = document.getElementById(first);
    if (element) {
      element.focus();
      element.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, 60);
}

function trimPayload(form) {
  const address = (party) => ({
    name: party.name.trim(),
    phone: party.phone.trim(),
    line1: party.line1.trim(),
    city: party.city.trim(),
    state: party.state.trim(),
    postalCode: party.postalCode.trim(),
    country: party.country.trim(),
  });
  return {
    v: 1,
    sender: address(form.sender),
    recipient: address(form.recipient),
    parcel: {
      description: form.parcel.description.trim(),
      category: form.parcel.category,
      weightKg: Number(form.parcel.weightKg),
      declaredValue: Number(form.parcel.declaredValue || 0),
      fragile: Boolean(form.parcel.fragile),
    },
    service: form.service,
    instructions: form.instructions.trim(),
  };
}

export function NewOrderPage() {
  const { session } = useOutletContext();
  const { wallet, role, profile } = session;
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const isAdmin = role === 'admin';

  const [step, setStep] = useState(0);
  const [form, setForm] = useState(() =>
    initialForm(isAdmin ? '' : profile?.displayName)
  );
  const [errors, setErrors] = useState({});
  const [ownerAddress, setOwnerAddress] = useState(isAdmin ? '' : wallet.address);
  const [submitError, setSubmitError] = useState(null);
  const [progress, setProgress] = useState(null);

  const ownerProfileQuery = useProfile(ownerAddress || undefined);
  const ownerProfile = ownerProfileQuery.data;
  const profilesQuery = useProfilesList();
  const { admins } = useAdmins();

  const usableAdmins = useMemo(
    () => admins.filter((admin) => admin.exists && admin.publicKey && admin.publicKey !== '0x'),
    [admins]
  );

  const customerProfiles = useMemo(
    () =>
      (profilesQuery.data ?? []).filter(
        (item) => item.exists && item.encryptionKey && item.encryptionKey !== '0x'
      ),
    [profilesQuery.data]
  );

  useEffect(() => {
    if (isAdmin || !profile?.displayName) return;
    setForm((current) =>
      current.sender.name
        ? current
        : {
            ...current,
            sender: { ...current.sender, name: profile.displayName },
          }
    );
  }, [profile?.displayName, isAdmin]);

  const updateParty = (party, key, value) => {
    setForm((current) => ({
      ...current,
      [party]: { ...current[party], [key]: value },
    }));
    setErrors((current) => {
      if (!current[`${party}-${key}`]) return current;
      const next = { ...current };
      delete next[`${party}-${key}`];
      return next;
    });
  };

  const updateParcel = (key, value) => {
    setForm((current) => ({
      ...current,
      parcel: { ...current.parcel, [key]: value },
    }));
    setErrors((current) => {
      if (!current[`parcel-${key}`]) return current;
      const next = { ...current };
      delete next[`parcel-${key}`];
      return next;
    });
  };

  const selectOwner = (address) => {
    setOwnerAddress(address);
    setErrors((current) => {
      if (!current.owner) return current;
      const next = { ...current };
      delete next.owner;
      return next;
    });
    const selected = customerProfiles.find(
      (item) => item.address.toLowerCase() === address.toLowerCase()
    );
    if (selected?.displayName) {
      setForm((current) => ({
        ...current,
        sender: { ...current.sender, name: selected.displayName },
      }));
    }
  };

  const validateAll = () => {
    const routeErrors = validateRoute(form, role, ownerAddress);
    const parcelErrors = validateParcel(form);
    return { ...routeErrors, ...parcelErrors };
  };

  const next = () => {
    const currentErrors =
      step === 0
        ? validateRoute(form, role, ownerAddress)
        : step === 1
          ? validateParcel(form)
          : validateAll();
    if (Object.keys(currentErrors).length) {
      setErrors(currentErrors);
      focusFirstError(currentErrors);
      return;
    }
    setErrors({});
    setStep((current) => Math.min(current + 1, 2));
  };

  const back = () => setStep((current) => Math.max(0, current - 1));

  const submit = async () => {
    const allErrors = validateAll();
    if (Object.keys(allErrors).length) {
      setErrors(allErrors);
      setStep(
        Object.keys(allErrors).some((key) => key.startsWith('parcel'))
          ? 1
          : 0
      );
      focusFirstError(allErrors);
      return;
    }

    if (!ownerAddress) {
      setErrors({ owner: 'Select the customer this order belongs to.' });
      return;
    }
    if (!ownerProfile?.exists) {
      setSubmitError(
        'The selected customer has not registered an encryption profile yet. Ask them to sign in and unlock their vault once.'
      );
      return;
    }
    if (!ownerProfile.encryptionKey || ownerProfile.encryptionKey === '0x') {
      setSubmitError('The selected customer has no encryption public key on-chain.');
      return;
    }
    if (!usableAdmins.length) {
      setSubmitError(
        'Operations has no registered vault key. Ask the admin to sign in and unlock their vault first.'
      );
      return;
    }

    setSubmitError(null);
    setProgress(0);

    let orderKey = null;
    try {
      const signer = wallet.assertCanWrite();
      const readContract = getContract(
        wallet.deployment.contractAddress,
        wallet.provider
      );
      const contract = getContract(wallet.deployment.contractAddress, signer);

      const recipients = new Map();
      recipients.set(ownerAddress.toLowerCase(), {
        address: ownerAddress,
        publicKey: ownerProfile.encryptionKey,
      });
      for (const admin of usableAdmins) {
        if (!recipients.has(admin.address.toLowerCase())) {
          recipients.set(admin.address.toLowerCase(), {
            address: admin.address,
            publicKey: admin.publicKey,
          });
        }
      }

      setProgress(1);
      let trackingId = null;
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const candidate = generateTrackingId();
        // eslint-disable-next-line no-await-in-loop
        const exists = await readContract.orderExists(candidate);
        if (!exists) {
          trackingId = candidate;
          break;
        }
      }
      if (!trackingId) {
        throw new Error('Could not find an unused tracking ID. Try again.');
      }

      const payload = trimPayload(form);
      orderKey = generateOrderKey();
      const ciphertext = await encryptPayload(payload, orderKey, trackingId);
      const holders = [...recipients.values()];
      const wrappedKeys = holders.map((holder) =>
        wrapOrderKey(orderKey, getBytes(holder.publicKey))
      );

      setProgress(2);
      const addresses = holders.map((holder) => holder.address);
      const tx = isAdmin
        ? await contract.createOrderFor(
            ownerAddress,
            trackingId,
            ciphertext,
            addresses,
            wrappedKeys
          )
        : await contract.createOrder(
            trackingId,
            ciphertext,
            addresses,
            wrappedKeys
          );

      setProgress(3);
      await tx.wait();
      setProgress(4);

      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      await queryClient.invalidateQueries({ queryKey: ['order'] });
      toast.success(
        'Order registered',
        `${trackingId} is on-chain with encrypted details and wrapped keys.`
      );
      window.setTimeout(() => {
        navigate(`/orders/${trackingId}`);
      }, 420);
    } catch (cause) {
      setProgress(null);
      const human = humanizeError(cause);
      setSubmitError(human.message);
      if (human.rejected) {
        toast.info('Transaction cancelled', 'Nothing was written on-chain.');
      }
    } finally {
      if (orderKey) zeroize(orderKey);
    }
  };

  const routeErrors = validateRoute(form, role, ownerAddress);
  const parcelErrors = validateParcel(form);
  const canContinue = step < 2;

  return (
    <div className="page">
      <PageHeader
        title={isAdmin ? 'Register an order' : 'New order'}
        subtitle={
          isAdmin
            ? 'Create an encrypted shipment on behalf of a customer. The customer receives the key envelope automatically.'
            : 'Your details are encrypted in this browser before the transaction. Only ciphertext and key envelopes go on-chain.'
        }
        backTo="/orders"
        backLabel="Back to orders"
      />

      <div className="wizard">
        <ol className="wizard__steps" aria-label="New order steps">
          {STEPS.map((item, index) => (
            <li
              key={item.key}
              className={`wizard-step ${
                index === step ? 'wizard-step--current' : ''
              } ${index < step ? 'wizard-step--done' : ''}`.trim()}
              aria-current={index === step ? 'step' : undefined}
            >
              <span className="wizard-step__num">
                {index < step ? <Check size={12} aria-hidden="true" /> : index + 1}
              </span>
              <span className="wizard-step__body">
                <span className="wizard-step__label">{item.label}</span>
                <span className="wizard-step__hint">{item.hint}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="wizard-layout">
          <div className="wizard-main">
            {step === 0 ? (
              <section className="card">
                <div className="card__header">
                  <div>
                    <h2 className="card__title">Route details</h2>
                    <p className="card__subtitle">
                      Who is sending it and where it is going. This is encrypted.
                    </p>
                  </div>
                  <MapPin size={16} aria-hidden="true" style={{ color: 'var(--ink-3)' }} />
                </div>
                <div className="card__body stack--lg" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {isAdmin ? (
                    <Field
                      label="Order belongs to"
                      htmlFor="owner"
                      required
                      error={errors.owner}
                      hint="Only customers with a registered encryption key are listed."
                    >
                      <Select
                        id="owner"
                        value={ownerAddress}
                        onChange={(event) => selectOwner(event.target.value)}
                        invalid={Boolean(errors.owner)}
                      >
                        <option value="">Select a customer…</option>
                        {customerProfiles.map((customer) => (
                          <option key={customer.address} value={customer.address}>
                            {customer.displayName || shortAddress(customer.address)} ·{' '}
                            {shortAddress(customer.address)}
                          </option>
                        ))}
                      </Select>
                      {!customerProfiles.length ? (
                        <span className="field__hint">
                          No registered customers yet. Each customer must sign in
                          and register their public key once.
                        </span>
                      ) : null}
                    </Field>
                  ) : null}

                  <div className="form-section">
                    <div className="form-section__head">
                      <h3>Sender</h3>
                      <span className="badge badge--neutral">Encrypted</span>
                    </div>
                    <div className="form-grid">
                      <TextField
                        id="sender-name"
                        label="Full name"
                        required
                        value={form.sender.name}
                        onChange={(event) => updateParty('sender', 'name', event.target.value)}
                        error={errors['sender-name']}
                        autoComplete="name"
                      />
                      <TextField
                        id="sender-phone"
                        label="Phone"
                        required
                        value={form.sender.phone}
                        onChange={(event) => updateParty('sender', 'phone', event.target.value)}
                        error={errors['sender-phone']}
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="+91 98450 11223"
                      />
                      <TextField
                        id="sender-line1"
                        label="Address"
                        required
                        className="field--full"
                        value={form.sender.line1}
                        onChange={(event) => updateParty('sender', 'line1', event.target.value)}
                        error={errors['sender-line1']}
                        autoComplete="street-address"
                        placeholder="Flat, street, area"
                      />
                      <TextField
                        id="sender-city"
                        label="City"
                        required
                        value={form.sender.city}
                        onChange={(event) => updateParty('sender', 'city', event.target.value)}
                        error={errors['sender-city']}
                        autoComplete="address-level2"
                      />
                      <TextField
                        id="sender-state"
                        label="State"
                        required
                        value={form.sender.state}
                        onChange={(event) => updateParty('sender', 'state', event.target.value)}
                        error={errors['sender-state']}
                        autoComplete="address-level1"
                      />
                      <TextField
                        id="sender-postalCode"
                        label="Postal code"
                        required
                        value={form.sender.postalCode}
                        onChange={(event) => updateParty('sender', 'postalCode', event.target.value)}
                        error={errors['sender-postalCode']}
                        autoComplete="postal-code"
                      />
                      <TextField
                        id="sender-country"
                        label="Country"
                        required
                        value={form.sender.country}
                        onChange={(event) => updateParty('sender', 'country', event.target.value)}
                        error={errors['sender-country']}
                        autoComplete="country-name"
                      />
                    </div>
                  </div>

                  <div className="form-section">
                    <div className="form-section__head">
                      <h3>Recipient</h3>
                      <span className="badge badge--neutral">Encrypted</span>
                    </div>
                    <div className="form-grid">
                      <TextField
                        id="recipient-name"
                        label="Full name"
                        required
                        value={form.recipient.name}
                        onChange={(event) => updateParty('recipient', 'name', event.target.value)}
                        error={errors['recipient-name']}
                        autoComplete="name"
                      />
                      <TextField
                        id="recipient-phone"
                        label="Phone"
                        required
                        value={form.recipient.phone}
                        onChange={(event) => updateParty('recipient', 'phone', event.target.value)}
                        error={errors['recipient-phone']}
                        inputMode="tel"
                        autoComplete="tel"
                      />
                      <TextField
                        id="recipient-line1"
                        label="Address"
                        required
                        className="field--full"
                        value={form.recipient.line1}
                        onChange={(event) => updateParty('recipient', 'line1', event.target.value)}
                        error={errors['recipient-line1']}
                        autoComplete="street-address"
                        placeholder="Flat, street, area"
                      />
                      <TextField
                        id="recipient-city"
                        label="City"
                        required
                        value={form.recipient.city}
                        onChange={(event) => updateParty('recipient', 'city', event.target.value)}
                        error={errors['recipient-city']}
                        autoComplete="address-level2"
                      />
                      <TextField
                        id="recipient-state"
                        label="State"
                        required
                        value={form.recipient.state}
                        onChange={(event) => updateParty('recipient', 'state', event.target.value)}
                        error={errors['recipient-state']}
                        autoComplete="address-level1"
                      />
                      <TextField
                        id="recipient-postalCode"
                        label="Postal code"
                        required
                        value={form.recipient.postalCode}
                        onChange={(event) => updateParty('recipient', 'postalCode', event.target.value)}
                        error={errors['recipient-postalCode']}
                        autoComplete="postal-code"
                      />
                      <TextField
                        id="recipient-country"
                        label="Country"
                        required
                        value={form.recipient.country}
                        onChange={(event) => updateParty('recipient', 'country', event.target.value)}
                        error={errors['recipient-country']}
                        autoComplete="country-name"
                      />
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {step === 1 ? (
              <section className="card">
                <div className="card__header">
                  <div>
                    <h2 className="card__title">Parcel details</h2>
                    <p className="card__subtitle">
                      Only the courier and operations will decrypt these.
                    </p>
                  </div>
                  <Package size={16} aria-hidden="true" style={{ color: 'var(--ink-3)' }} />
                </div>
                <div className="card__body stack--lg" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <TextField
                    id="parcel-description"
                    label="What is inside?"
                    required
                    value={form.parcel.description}
                    onChange={(event) => updateParcel('description', event.target.value)}
                    error={errors['parcel-description']}
                    placeholder="e.g. Hardcover books"
                  />
                  <div className="form-grid">
                    <Field label="Category" htmlFor="parcel-category" required error={errors['parcel-category']}>
                      <Select
                        id="parcel-category"
                        value={form.parcel.category}
                        onChange={(event) => updateParcel('category', event.target.value)}
                        invalid={Boolean(errors['parcel-category'])}
                      >
                        {CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <TextField
                      id="parcel-weightKg"
                      label="Weight (kg)"
                      required
                      value={form.parcel.weightKg}
                      onChange={(event) => updateParcel('weightKg', event.target.value)}
                      error={errors['parcel-weightKg']}
                      inputMode="decimal"
                      placeholder="2.4"
                    />
                    <TextField
                      id="parcel-declaredValue"
                      label="Declared value (INR)"
                      value={form.parcel.declaredValue}
                      onChange={(event) => updateParcel('declaredValue', event.target.value)}
                      error={errors['parcel-declaredValue']}
                      inputMode="numeric"
                      placeholder="2400"
                      hint="No payment is collected in this demo."
                    />
                    <Field label="Service" htmlFor="parcel-service">
                      <SegmentedControl
                        ariaLabel="Service level"
                        size="sm"
                        options={[
                          { value: 'Standard', label: 'Standard' },
                          { value: 'Express', label: 'Express' },
                        ]}
                        value={form.service}
                        onChange={(value) =>
                          setForm((current) => ({ ...current, service: value }))
                        }
                      />
                    </Field>
                  </div>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={form.parcel.fragile}
                      onChange={(event) => updateParcel('fragile', event.target.checked)}
                    />
                    <span className="check__text">
                      <strong>Fragile handling</strong>
                      <span className="field__hint" style={{ display: 'block', marginTop: 2 }}>
                        The courier sees this flag and can add a handling note.
                      </span>
                    </span>
                  </label>
                  <TextAreaField
                    id="parcel-instructions"
                    label="Delivery instructions"
                    optional
                    value={form.instructions}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, instructions: event.target.value }))
                    }
                    maxLength={500}
                    placeholder="Call on arrival, leave with security…"
                    hint="Encrypted with the order payload. Visible to the courier and operations."
                  />
                </div>
              </section>
            ) : null}

            {step === 2 ? (
              <section className="card">
                <div className="card__header">
                  <div>
                    <h2 className="card__title">Review &amp; register</h2>
                    <p className="card__subtitle">
                      Check the details. They will be encrypted before your wallet
                      opens.
                    </p>
                  </div>
                  <ShieldCheck size={16} aria-hidden="true" style={{ color: 'var(--green)' }} />
                </div>
                <div className="card__body stack">
                  <div className="review-block">
                    <div className="review-block__head">
                      <h3>Route</h3>
                      <button type="button" className="btn btn--link" onClick={() => setStep(0)}>
                        Edit
                      </button>
                    </div>
                    <div className="review-route">
                      <div>
                        <span className="eyebrow">From</span>
                        <div className="review-route__name">{form.sender.name}</div>
                        <div className="review-route__address">
                          {form.sender.line1}, {form.sender.city}, {form.sender.state}{' '}
                          {form.sender.postalCode}, {form.sender.country}
                        </div>
                      </div>
                      <ArrowRight size={18} aria-hidden="true" />
                      <div>
                        <span className="eyebrow">To</span>
                        <div className="review-route__name">{form.recipient.name}</div>
                        <div className="review-route__address">
                          {form.recipient.line1}, {form.recipient.city}, {form.recipient.state}{' '}
                          {form.recipient.postalCode}, {form.recipient.country}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="review-block">
                    <div className="review-block__head">
                      <h3>Parcel</h3>
                      <button type="button" className="btn btn--link" onClick={() => setStep(1)}>
                        Edit
                      </button>
                    </div>
                    <div className="review-grid">
                      <div>
                        <span className="eyebrow">Contents</span>
                        <div>{form.parcel.description}</div>
                      </div>
                      <div>
                        <span className="eyebrow">Category</span>
                        <div>{form.parcel.category}</div>
                      </div>
                      <div>
                        <span className="eyebrow">Weight</span>
                        <div>{formatWeight(form.parcel.weightKg)}</div>
                      </div>
                      <div>
                        <span className="eyebrow">Declared value</span>
                        <div>{formatCurrencyINR(form.parcel.declaredValue)}</div>
                      </div>
                      <div>
                        <span className="eyebrow">Service</span>
                        <div>{form.service}</div>
                      </div>
                      <div>
                        <span className="eyebrow">Handling</span>
                        <div>{form.parcel.fragile ? 'Fragile' : 'Standard'}</div>
                      </div>
                    </div>
                    {form.instructions ? (
                      <div style={{ marginTop: 12 }}>
                        <span className="eyebrow">Instructions</span>
                        <p className="muted-2" style={{ marginTop: 3 }}>
                          {form.instructions}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <Callout tone="info" title="What gets written on-chain">
                    A random order key encrypts this payload. The key is wrapped
                    for {isAdmin ? 'the customer and operations' : 'you and operations'}.
                    The chain stores ciphertext, wrapped keys, addresses, status
                    and timestamps — never the name, phone, address or parcel
                    text.
                  </Callout>

                  {submitError ? (
                    <Callout tone="danger" role="alert" title="Could not register">
                      {submitError}
                    </Callout>
                  ) : null}
                </div>
              </section>
            ) : null}

            <div className="wizard-actions">
              <Button variant="ghost" onClick={back} disabled={step === 0} icon={ArrowLeft}>
                Back
              </Button>
              <span className="field__hint">
                Step {step + 1} of {STEPS.length}
              </span>
              {canContinue ? (
                <Button variant="primary" onClick={next} iconRight={ArrowRight}>
                  Continue
                </Button>
              ) : (
                <Button variant="primary" onClick={submit} icon={Lock}>
                  Encrypt &amp; register
                </Button>
              )}
            </div>
          </div>

          <aside className="wizard-aside">
            <div className="card wizard-summary">
              <div className="card__header">
                <h2 className="card__title">Shipment summary</h2>
                <StatusBadge status="Created" />
              </div>
              <div className="card__body">
                {isAdmin ? (
                  <div className="summary-row">
                    <span>Customer</span>
                    <strong>
                      {ownerProfile?.displayName ||
                        (ownerAddress ? shortAddress(ownerAddress) : 'Not selected')}
                    </strong>
                  </div>
                ) : null}
                <div className="summary-row">
                  <span>From</span>
                  <strong>{form.sender.name || '—'}</strong>
                </div>
                <div className="summary-row">
                  <span>To</span>
                  <strong>{form.recipient.name || '—'}</strong>
                </div>
                <div className="summary-row">
                  <span>Route</span>
                  <strong>
                    {form.sender.city || '—'} → {form.recipient.city || '—'}
                  </strong>
                </div>
                <div className="summary-row">
                  <span>Parcel</span>
                  <strong>{form.parcel.description || '—'}</strong>
                </div>
                <div className="summary-row">
                  <span>Service</span>
                  <strong>{form.service}</strong>
                </div>
                <div className="summary-row">
                  <span>Weight</span>
                  <strong>{formatWeight(form.parcel.weightKg)}</strong>
                </div>
                <div className="summary-row">
                  <span>Value</span>
                  <strong>{formatCurrencyINR(form.parcel.declaredValue)}</strong>
                </div>

                <div className="summary-keys">
                  <div className="row" style={{ gap: 7 }}>
                    <ShieldCheck size={14} aria-hidden="true" style={{ color: 'var(--green)' }} />
                    <strong>Encrypted end-to-end</strong>
                  </div>
                  <p>
                    AES-256-GCM in this tab. A per-order key is wrapped for the
                    customer, operations and — at dispatch — the assigned courier.
                  </p>
                </div>
              </div>
            </div>

            <Callout tone="info" title="No payment in this demo">
              BlockTrack tracks the shipment and its privacy properties. It does
              not collect fees or payments.
            </Callout>

            <div className="wizard-tips">
              <Truck size={14} aria-hidden="true" />
              <span>
                After registration, operations can assign a courier. Only then
                does the courier receive an order key.
              </span>
            </div>
          </aside>
        </div>
      </div>

      <Modal
        open={progress !== null}
        onClose={() => {}}
        title="Registering your encrypted order"
        description="Keep this tab open while the transaction is written."
        hideClose
        closeOnBackdrop={false}
      >
        <ol className="progress-steps">
          {[
            'Encrypting details in your browser',
            'Preparing key envelopes',
            'Waiting for your wallet',
            'Writing the ciphertext to the chain',
            'Done',
          ].map((label, index) => {
            const state =
              progress === null
                ? 'pending'
                : index < progress
                  ? 'done'
                  : index === progress
                    ? 'active'
                    : 'pending';
            return (
              <li className={`progress-step-row progress-step-row--${state}`} key={label}>
                <span className="progress-step-row__icon">
                  {state === 'done' ? (
                    <Check size={13} aria-hidden="true" />
                  ) : state === 'active' ? (
                    <span className="spinner" aria-hidden="true" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span>{label}</span>
              </li>
            );
          })}
        </ol>
        <p className="field__hint" style={{ marginTop: 16 }}>
          The order key is generated locally and never sent to a server. Your
          wallet will show one transaction; the signature is only for the vault.
        </p>
      </Modal>
    </div>
  );
}
