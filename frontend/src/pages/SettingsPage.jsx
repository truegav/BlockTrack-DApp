import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  KeyRound,
  Link2,
  Lock,
  LogOut,
  Palette,
  Settings,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { getContract, humanizeError } from '../lib/contract.js';
import { shortAddress } from '../lib/format.js';
import { roleLabel } from '../shared/personas.js';
import { Avatar } from '../components/ui/Avatar.jsx';
import { Badge, RoleBadge } from '../components/ui/Badges.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Callout } from '../components/ui/Callout.jsx';
import { TextField } from '../components/ui/Form.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { SegmentedControl } from '../components/ui/SegmentedControl.jsx';
import { AddressChip, KeyValue } from '../components/ui/Identity.jsx';
import { CopyButton } from '../components/ui/CopyButton.jsx';

export function SettingsPage() {
  const { session } = useOutletContext();
  const { wallet, vault, profile, role } = session;
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [nameError, setNameError] = useState('');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.displayName || '');
  }, [profile?.displayName]);

  const trimmed = displayName.trim();
  const nameChanged = trimmed !== (profile?.displayName || '');
  const canSave = nameChanged && trimmed.length > 0 && trimmed.length <= 48;

  const saveName = async (event) => {
    event.preventDefault();
    if (!trimmed) {
      setNameError('Enter a display name.');
      return;
    }
    if (trimmed.length > 48) {
      setNameError('Use 48 characters or fewer.');
      return;
    }

    setSavingName(true);
    setNameError('');
    try {
      const signer = wallet.assertCanWrite();
      const contract = getContract(wallet.deployment.contractAddress, signer);
      const tx = await contract.updateDisplayName(trimmed);
      await tx.wait();
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      await queryClient.invalidateQueries({ queryKey: ['profiles-list'] });
      toast.success('Display name updated', 'The change is written on-chain.');
    } catch (cause) {
      const human = humanizeError(cause);
      setNameError(human.message);
    } finally {
      setSavingName(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Settings"
        subtitle="Your profile, vault, appearance and connection. Private shipment data is never stored here."
      />

      <div className="settings-grid">
        <section className="card">
          <div className="card__header">
            <div>
              <h2 className="card__title">Profile</h2>
              <p className="card__subtitle">
                The display name is public on-chain. It is the only profile field
                stored there.
              </p>
            </div>
            <RoleBadge role={role} />
          </div>
          <div className="card__body">
            <div className="profile-head">
              <Avatar
                name={profile?.displayName || wallet.address}
                address={wallet.address}
                size="xl"
              />
              <div style={{ minWidth: 0 }}>
                <div className="profile-head__name">
                  {profile?.displayName || shortAddress(wallet.address)}
                </div>
                <div className="profile-head__meta">
                  <AddressChip address={wallet.address} />
                  <span aria-hidden="true">·</span>
                  <span>{roleLabel(role)}</span>
                </div>
              </div>
            </div>

            <form onSubmit={saveName} className="stack" style={{ marginTop: 20 }}>
              <TextField
                label="Display name"
                value={displayName}
                onChange={(event) => {
                  setDisplayName(event.target.value);
                  if (nameError) setNameError('');
                }}
                maxLength={48}
                error={nameError || undefined}
                hint="Shown to operations and assigned couriers."
              />
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={!canSave || savingName}
                  loading={savingName}
                >
                  Save name
                </Button>
              </div>
            </form>
          </div>
        </section>

        <section className="card">
          <div className="card__header">
            <div>
              <h2 className="card__title">Vault &amp; encryption</h2>
              <p className="card__subtitle">
                Your private key lives in this tab only. The public key is on-chain.
              </p>
            </div>
            <span className="badge badge--green">
              <ShieldCheck size={11} aria-hidden="true" />
              Unlocked
            </span>
          </div>
          <div className="card__body">
            <div className="settings-list">
              <KeyValue label="Vault fingerprint">
                <span className="mono" translate="no">
                  {vault.fingerprint}
                </span>
              </KeyValue>
              <KeyValue label="Public key">
                <span className="mono" style={{ fontSize: 10.5 }}>
                  {shortAddress(vault.publicKey)}
                </span>
                <CopyButton value={vault.publicKey} label="Copy public key" />
              </KeyValue>
              <KeyValue label="Registered">
                <span>{profile?.exists ? 'Yes, on-chain' : 'No'}</span>
              </KeyValue>
            </div>
            <div className="row" style={{ marginTop: 16 }}>
              <Button variant="secondary" icon={Lock} onClick={vault.lock}>
                Lock vault
              </Button>
              <span className="field__hint">
                Removes decrypted data from memory.
              </span>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card__header">
            <div>
              <h2 className="card__title">Appearance</h2>
              <p className="card__subtitle">
                Follows your system unless you choose otherwise.
              </p>
            </div>
            <Palette size={16} aria-hidden="true" style={{ color: 'var(--ink-3)' }} />
          </div>
          <div className="card__body">
            <SegmentedControl
              ariaLabel="Theme"
              value={theme}
              onChange={setTheme}
              options={[
                { value: 'system', label: 'System' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
            <p className="field__hint" style={{ marginTop: 12 }}>
              Light and dark share the same tokens, spacing and focus system.
            </p>
          </div>
        </section>

        <section className="card">
          <div className="card__header">
            <div>
              <h2 className="card__title">Connection</h2>
              <p className="card__subtitle">
                The app reads from a public RPC and signs locally.
              </p>
            </div>
            <Link2 size={16} aria-hidden="true" style={{ color: 'var(--ink-3)' }} />
          </div>
          <div className="card__body">
            <div className="settings-list">
              <KeyValue label="Mode">
                <Badge tone={wallet.mode === 'demo' ? 'amber' : 'blue'}>
                  {wallet.mode === 'demo' ? 'Demo account' : 'Browser wallet'}
                </Badge>
              </KeyValue>
              <KeyValue label="Chain">
                <span className="tabular">{wallet.deployment.chainId}</span>
              </KeyValue>
              <KeyValue label="RPC">
                <span className="mono" style={{ fontSize: 11 }}>
                  {wallet.deployment.rpcUrl}
                </span>
              </KeyValue>
              <KeyValue label="Contract">
                <AddressChip address={wallet.deployment.contractAddress} />
              </KeyValue>
              <KeyValue label="Deployment block">
                <span className="tabular">{wallet.deployment.deploymentBlock}</span>
              </KeyValue>
            </div>
            <div className="row row--wrap" style={{ marginTop: 16 }}>
              {wallet.mode === 'injected' ? (
                <Button variant="secondary" onClick={wallet.switchNetwork}>
                  Switch to Anvil
                </Button>
              ) : null}
              <Button variant="ghost" icon={LogOut} onClick={wallet.disconnect}>
                {wallet.mode === 'demo' ? 'Sign out' : 'Disconnect'}
              </Button>
            </div>
          </div>
        </section>
      </div>

      <Callout tone="info" title="What is stored where">
        The chain stores your display name, public key, order ciphertext, status
        history and wrapped key envelopes. Names, phone numbers, addresses and
        notes inside an order are encrypted to the order key and never appear in
        your profile.
      </Callout>

      <div className="row" style={{ color: 'var(--ink-3)', fontSize: 11.5 }}>
        <Settings size={13} aria-hidden="true" />
        <span>
          There is no password, email address, or server-side account to manage.
        </span>
        <UserRound size={13} aria-hidden="true" />
        <KeyRound size={13} aria-hidden="true" />
      </div>
    </div>
  );
}
