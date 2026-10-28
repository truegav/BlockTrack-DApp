import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  KeyRound,
  Lock,
  MapPin,
  Package,
  Phone,
  ShieldCheck,
  Truck,
  UserRound,
  X,
} from 'lucide-react';
import { useCouriers, useProfiles } from '../hooks/useProfile.js';
import { useOrder } from '../hooks/useOrders.js';
import { useToast } from '../context/ToastContext.jsx';
import { getContract, humanizeError } from '../lib/contract.js';
import {
  formatCurrencyINR,
  formatDateTime,
  formatRelative,
  formatWeight,
  shortAddress,
  toDateTimeLocalValue,
} from '../lib/format.js';
import {
  canCancelOrder,
  canUpdateOrder,
  isFinalStatus,
  nextStatuses,
  statusIndex,
  statusMeta,
} from '../lib/status.js';
import { encryptNote } from '../shared/crypto.js';
import { Badge, StatusBadge } from '../components/ui/Badges.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Callout } from '../components/ui/Callout.jsx';
import { CopyButton } from '../components/ui/CopyButton.jsx';
import {
  Field,
  Textarea,
  TextField,
} from '../components/ui/Form.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { ChainRecord } from '../components/domain/ChainRecord.jsx';
import { AccessPanel } from '../components/domain/AccessPanel.jsx';
import { AssignCourierDialog } from '../components/domain/AssignCourierDialog.jsx';
import { OrderProgress } from '../components/domain/OrderProgress.jsx';
import { OrderTimeline } from '../components/domain/OrderTimeline.jsx';

const ZERO = '0x0000000000000000000000000000000000000000';

function DetailSkeleton() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Skeleton width={260} height={26} />
          <div style={{ marginTop: 10 }}>
            <Skeleton width={320} height={11} />
          </div>
        </div>
        <Skeleton width={160} height={38} />
      </div>
      <div className="card card--pad">
        <Skeleton width="100%" height={4} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24 }}>
          <Skeleton width="70%" height={14} />
          <Skeleton width="60%" height={14} />
          <Skeleton width="50%" height={14} />
          <Skeleton width="66%" height={14} />
        </div>
      </div>
      <div className="detail-grid">
        <div className="card card--pad">
          <Skeleton width="40%" height={18} />
          <div style={{ marginTop: 18 }} className="stack">
            <Skeleton width="100%" height={72} />
            <Skeleton width="100%" height={72} />
          </div>
        </div>
        <div className="card card--pad">
          <Skeleton width="40%" height={18} />
          <div style={{ marginTop: 18 }} className="stack">
            <Skeleton width="100%" height={44} />
            <Skeleton width="100%" height={44} />
            <Skeleton width="100%" height={44} />
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, children }) {
  return (
    <div className="info-row">
      {Icon ? (
        <span className="info-row__icon">
          <Icon size={13} aria-hidden="true" />
        </span>
      ) : null}
      <span className="info-row__label">{label}</span>
      <span className="info-row__value">{children}</span>
    </div>
  );
}

function RouteCard({ order, revealed, onToggle }) {
  const sender = order.payload?.sender;
  const recipient = order.payload?.recipient;
  const courierAssigned = order.courier && order.courier !== ZERO;

  const party = (data, label) => (
    <div className="route-party">
      <span className="eyebrow">{label}</span>
      <div className="route-party__name">{data?.name || '—'}</div>
      <div className="route-party__address">
        {revealed ? (
          <>
            {data?.line1}
            <br />
            {data?.city}, {data?.state} {data?.postalCode}
            <br />
            {data?.country}
          </>
        ) : (
          <span className="sensitive">Hidden until revealed</span>
        )}
      </div>
      <div className="route-party__phone">
        <Phone size={12} aria-hidden="true" />
        {revealed ? data?.phone : '••••••••••'}
      </div>
    </div>
  );

  return (
    <section className="card">
      <div className="card__header">
        <div>
          <h2 className="card__title">Route</h2>
          <p className="card__subtitle">
            Contact details are decrypted in this tab and never written to the chain.
          </p>
        </div>
        <button type="button" className="btn btn--link" onClick={onToggle}>
          {revealed ? 'Hide contact details' : 'Reveal contact details'}
        </button>
      </div>
      <div className="card__body">
        <div className="route-grid">
          {party(sender, 'From')}
          <span className="route-grid__arrow" aria-hidden="true">
            <MapPin size={16} />
          </span>
          {party(recipient, 'To')}
        </div>
        <div className="route-courier">
          <span className="row" style={{ gap: 7 }}>
            <Truck size={14} aria-hidden="true" />
            <span className="eyebrow">Courier</span>
          </span>
          <span>
            {courierAssigned
              ? shortAddress(order.courier)
              : 'Not assigned yet'}
          </span>
        </div>
      </div>
    </section>
  );
}

function ParcelCard({ order }) {
  const parcel = order.payload?.parcel;
  return (
    <section className="card">
      <div className="card__header">
        <div>
          <h2 className="card__title">Parcel</h2>
          <p className="card__subtitle">Encrypted payload, decrypted locally.</p>
        </div>
        <Package size={16} aria-hidden="true" style={{ color: 'var(--ink-3)' }} />
      </div>
      <div className="card__body">
        <div className="parcel-headline">
          <div>
            <div className="parcel-headline__title">
              {parcel?.description || 'Encrypted parcel'}
            </div>
            <div className="row row--wrap" style={{ gap: 6, marginTop: 6 }}>
              <Badge tone="neutral">{parcel?.category || 'Unknown'}</Badge>
              {parcel?.fragile ? <Badge tone="amber">Fragile</Badge> : null}
              <Badge tone="blue">{order.payload?.service || 'Standard'}</Badge>
            </div>
          </div>
          <div className="parcel-headline__value">
            {formatCurrencyINR(parcel?.declaredValue)}
            <span>declared value</span>
          </div>
        </div>

        <div className="parcel-grid">
          <div>
            <span className="eyebrow">Weight</span>
            <div>{formatWeight(parcel?.weightKg)}</div>
          </div>
          <div>
            <span className="eyebrow">Category</span>
            <div>{parcel?.category || '—'}</div>
          </div>
          <div>
            <span className="eyebrow">Handling</span>
            <div>{parcel?.fragile ? 'Fragile' : 'Standard'}</div>
          </div>
          <div>
            <span className="eyebrow">Service</span>
            <div>{order.payload?.service || 'Standard'}</div>
          </div>
        </div>

        {order.payload?.instructions ? (
          <div className="parcel-instructions">
            <span className="eyebrow">Delivery instructions</span>
            <p>{order.payload.instructions}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function UpdateStatusDialog({ open, onClose, order }) {
  const wallet = useOutletContext().session.wallet;
  const toast = useToast();
  const queryClient = useQueryClient();
  const options = nextStatuses(order.status);
  const [status, setStatus] = useState(options[0]?.key || '');
  const [note, setNote] = useState('');
  const [location, setLocation] = useState('');
  const [eta, setEta] = useState(toDateTimeLocalValue());
  const [receivedBy, setReceivedBy] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const defaults = nextStatuses(order.status);
    setStatus(defaults[0]?.key || '');
    setNote('');
    setLocation('');
    setEta(toDateTimeLocalValue());
    setReceivedBy(order.payload?.recipient?.name || '');
    setError('');
    setSaving(false);
  }, [open, order.id, order.status, order.payload?.recipient?.name]);

  if (!options.length) return null;

  const submit = async () => {
    if (!note.trim()) {
      setError('Add a short note for the timeline.');
      return;
    }
    if (!order.orderKey) {
      setError('This browser has no order key for the shipment.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const signer = wallet.assertCanWrite();
      const contract = getContract(wallet.deployment.contractAddress, signer);
      const payload = {
        v: 1,
        note: note.trim(),
        ...(location.trim() ? { location: location.trim() } : {}),
        ...(eta ? { eta: new Date(eta).toISOString() } : {}),
        ...(status === 'Delivered' && receivedBy.trim()
          ? { receivedBy: receivedBy.trim() }
          : {}),
      };
      const encryptedNote = await encryptNote(payload, order.orderKey, order.id);
      const tx = await contract.updateStatus(
        order.id,
        statusIndex(status),
        encryptedNote
      );
      await tx.wait();
      await queryClient.invalidateQueries({ queryKey: ['order'] });
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Status updated', 'The encrypted note is on-chain.');
      onClose();
    } catch (cause) {
      const human = humanizeError(cause);
      setError(human.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      title="Update shipment status"
      description="The contract enforces legal transitions. The note and coordinates are encrypted before they are sent."
      closeOnBackdrop={!saving}
      hideClose={saving}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={saving} icon={Lock}>
            Encrypt &amp; update
          </Button>
        </>
      }
    >
      <div className="stack">
        <div className="current-status">
          <span className="eyebrow">Current status</span>
          <StatusBadge status={order.status} />
        </div>

        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field__label">Next status</legend>
          <div className="radio-cards" style={{ marginTop: 8 }}>
            {options.map((option) => {
              const Icon = option.icon;
              return (
                <label className="radio-card" key={option.key}>
                  <input
                    type="radio"
                    name="next-status"
                    value={option.key}
                    checked={status === option.key}
                    onChange={() => setStatus(option.key)}
                  />
                  <span>
                    <span className="radio-card__title">
                      <Icon size={14} aria-hidden="true" />
                      {option.label}
                    </span>
                    <span className="radio-card__desc">{option.description}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <Field label="Timeline note" htmlFor="update-note" required>
          <Textarea
            id="update-note"
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
              if (error) setError('');
            }}
            maxLength={900}
            placeholder="e.g. Arrived at the local delivery centre."
          />
        </Field>

        <div className="form-grid">
          <TextField
            id="update-location"
            label="Location"
            optional
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="e.g. Indiranagar, Bengaluru"
          />
          <TextField
            id="update-eta"
            label="ETA"
            optional
            type="datetime-local"
            value={eta}
            onChange={(event) => setEta(event.target.value)}
          />
        </div>

        {status === 'Delivered' ? (
          <TextField
            id="update-received-by"
            label="Received by"
            value={receivedBy}
            onChange={(event) => setReceivedBy(event.target.value)}
            hint="Shown as “Signed by” in the timeline. Stored encrypted."
          />
        ) : null}

        <Callout tone="info">
          This writes one transaction. The status and note hash are public; the
          note text is encrypted with the order key.
        </Callout>

        {error ? (
          <Callout tone="danger" role="alert" title="Update failed">
            {error}
          </Callout>
        ) : null}
      </div>
    </Modal>
  );
}

function CancelOrderDialog({ open, onClose, order }) {
  const wallet = useOutletContext().session.wallet;
  const toast = useToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason('');
    setError('');
    setSaving(false);
  }, [open, order.id]);

  const submit = async () => {
    if (!order.orderKey) {
      setError('This browser has no order key for the shipment.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const signer = wallet.assertCanWrite();
      const contract = getContract(wallet.deployment.contractAddress, signer);
      const encrypted = await encryptNote(
        {
          v: 1,
          note: reason.trim() || 'Cancelled before pickup.',
          reason: 'Cancelled',
        },
        order.orderKey,
        order.id
      );
      const tx = await contract.cancelOrder(order.id, encrypted);
      await tx.wait();
      await queryClient.invalidateQueries({ queryKey: ['order'] });
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Order cancelled', 'The cancellation is written on-chain.');
      onClose();
    } catch (cause) {
      const human = humanizeError(cause);
      setError(human.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      title="Cancel this order?"
      description="Cancellation is final on-chain. The encrypted details remain readable to the authorised wallets."
      size="sm"
      closeOnBackdrop={!saving}
      hideClose={saving}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Keep order
          </Button>
          <Button variant="danger" onClick={submit} loading={saving} icon={X}>
            Cancel order
          </Button>
        </>
      }
    >
      <div className="stack">
        <Callout tone="danger" title="This cannot be undone">
          The status becomes Cancelled and no further updates are possible.
        </Callout>
        <Field label="Reason" htmlFor="cancel-reason" optional hint="Encrypted with the order key.">
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            placeholder="e.g. Ordered by mistake."
          />
        </Field>
        {error ? (
          <Callout tone="danger" role="alert">
            {error}
          </Callout>
        ) : null}
      </div>
    </Modal>
  );
}

export function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session, ordersState } = useOutletContext();
  const { wallet, role } = session;
  const query = useOrder(id);
  const { couriers } = useCouriers();
  const order = query.data;

  const [revealed, setRevealed] = useState(true);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const addresses = useMemo(() => {
    if (!order) return [];
    const list = [order.owner, order.courier, ...(order.history ?? []).map((item) => item.actor), ...(order.keyHolders ?? [])];
    return list.filter(Boolean);
  }, [order]);

  const { data: profiles } = useProfiles(addresses);

  if (query.isLoading) return <DetailSkeleton />;

  if (query.error) {
    return (
      <div className="page">
        <PageHeader
          title="Shipment not found"
          docTitle="Shipment not found"
          backTo={role === 'courier' ? '/queue' : '/orders'}
          backLabel={role === 'courier' ? 'Back to queue' : 'Back to orders'}
        />
        <div className="card">
          <div className="empty">
            <div className="empty__art" style={{ background: 'var(--red-soft)', borderColor: 'transparent', color: 'var(--red)' }}>
              <AlertTriangle />
            </div>
            <h2 className="empty__title">Couldn&apos;t open this shipment</h2>
            <p className="empty__text">{humanizeError(query.error).message}</p>
            <div className="empty__actions">
              <button type="button" className="btn btn--secondary" onClick={() => navigate(-1)}>
                <ArrowLeft size={14} aria-hidden="true" />
                Go back
              </button>
              <button type="button" className="btn btn--primary" onClick={() => query.refetch()}>
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!order) return null;

  if (!order.access) {
    return (
      <div className="page">
        <PageHeader
          title={`Shipment ${order.id}`}
          docTitle={`Shipment ${order.id}`}
          backTo={role === 'courier' ? '/queue' : '/orders'}
          backLabel={role === 'courier' ? 'Back to queue' : 'Back to orders'}
          meta={<StatusBadge status={order.status} />}
        />
        <div className="card">
          <div className="empty">
            <div className="empty__art">
              <Lock />
            </div>
            <h2 className="empty__title">No key for this shipment</h2>
            <p className="empty__text">
              This order exists, but your wallet does not hold an order key. Only
              the customer, the assigned courier, and operations can decrypt it.
            </p>
            <div className="empty__actions">
              <button type="button" className="btn btn--secondary" onClick={() => navigate(-1)}>
                <ArrowLeft size={14} aria-hidden="true" />
                Go back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const canUpdate = canUpdateOrder({
    status: order.status,
    address: wallet.address,
    courier: order.courier,
    role,
  });
  const canAssign =
    role === 'admin' && !isFinalStatus(order.status);
  const canCancel = canCancelOrder({
    status: order.status,
    address: wallet.address,
    owner: order.owner,
    role,
  });

  const isUnassigned = !order.courier || order.courier === ZERO;
  const currentStatus = statusMeta(order.status);
  const targetPath = role === 'courier' ? '/queue' : '/orders';

  const actions = (
    <>
      {canAssign ? (
        <Button variant="secondary" icon={Truck} onClick={() => setAssignOpen(true)}>
          {isUnassigned ? 'Assign courier' : 'Reassign'}
        </Button>
      ) : null}
      {canUpdate ? (
        <Button variant="primary" icon={Lock} onClick={() => setUpdateOpen(true)}>
          Update status
        </Button>
      ) : null}
      {canCancel ? (
        <Button variant="danger-soft" icon={X} onClick={() => setCancelOpen(true)}>
          Cancel
        </Button>
      ) : null}
    </>
  );

  return (
    <div className="page">
      <PageHeader
        title={`Shipment ${order.id}`}
        docTitle={`Shipment ${order.id}`}
        subtitle={`Registered ${formatDateTime(order.createdAt)} · updated ${formatRelative(order.updatedAt)}`}
        backTo={targetPath}
        backLabel={role === 'courier' ? 'Back to queue' : 'Back to orders'}
        meta={
          <>
            <StatusBadge status={order.status} />
            <Badge tone="green" icon={Lock}>
              Encrypted
            </Badge>
            <span className="row" style={{ gap: 2 }}>
              <span className="mono text-sm" translate="no">
                {order.id}
              </span>
              <CopyButton value={order.id} label="Copy tracking ID" />
            </span>
          </>
        }
        actions={actions}
        actionsClassName="page-actions--compact"
      />

      {currentStatus.key === 'FailedAttempt' ? (
        <Callout tone="warning" title="Delivery attempt failed">
          The courier can schedule a retry by moving the order back to Out for
          delivery. The admin can also cancel it.
        </Callout>
      ) : null}
      {currentStatus.key === 'Cancelled' ? (
        <Callout tone="danger" title="This order was cancelled">
          No further status updates are possible. The encrypted record remains
          readable to the owner, courier and operations.
        </Callout>
      ) : null}
      {isUnassigned && !isFinalStatus(order.status) ? (
        <Callout
          tone="info"
          title="Waiting for dispatch"
          action={
            role === 'admin' ? (
              <Button size="sm" variant="secondary" onClick={() => setAssignOpen(true)}>
                Assign now
              </Button>
            ) : null
          }
        >
          The admin has not assigned a courier yet. Couriers cannot read the
          order until they receive a wrapped key.
        </Callout>
      ) : null}

      <section className="card card--pad">
        <div className="row row--between" style={{ marginBottom: 18, flexWrap: 'wrap' }}>
          <div>
            <h2 className="card__title">Journey</h2>
            <p className="card__subtitle">
              Progress rail from the on-chain status history.
            </p>
          </div>
          <span className="badge badge--outline">
            <ShieldCheck size={11} aria-hidden="true" />
            {order.history?.length ?? 1} verified updates
          </span>
        </div>
        <OrderProgress status={order.status} />
      </section>

      <div className="detail-grid">
        <div className="stack">
          <RouteCard
            order={order}
            revealed={revealed}
            onToggle={() => setRevealed((current) => !current)}
          />
          <ParcelCard order={order} />
          <ChainRecord order={order} />
        </div>

        <div className="stack">
          <section className="card">
            <div className="card__header">
              <div>
                <h2 className="card__title">Timeline</h2>
                <p className="card__subtitle">
                  Newest first. Notes are decrypted with this order&apos;s key.
                </p>
              </div>
              <KeyRound size={15} aria-hidden="true" style={{ color: 'var(--ink-3)' }} />
            </div>
            <div className="card__body">
              <OrderTimeline
                history={order.history}
                profiles={profiles}
                emptyText="No updates yet."
              />
            </div>
          </section>

          <AccessPanel order={order} profiles={profiles} />

          {role === 'courier' && !isFinalStatus(order.status) ? (
            <Callout tone="info" title="You hold the order key">
              You can read the recipient details above. Add a note when you pick
              up, move, or deliver the parcel.
            </Callout>
          ) : null}
        </div>
      </div>

      <UpdateStatusDialog
        open={updateOpen}
        onClose={() => setUpdateOpen(false)}
        order={order}
      />
      <AssignCourierDialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        order={order}
        couriers={couriers}
        orders={ordersState?.orders ?? []}
      />
      <CancelOrderDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        order={order}
      />
    </div>
  );
}
