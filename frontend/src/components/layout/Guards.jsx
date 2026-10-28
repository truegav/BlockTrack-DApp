import { useState } from 'react';
import {
  Navigate,
  Outlet,
  Link,
  useLocation,
  useOutletContext,
} from 'react-router-dom';
import { AlertTriangle, ArrowRight, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { useWallet } from '../../context/WalletContext.jsx';
import { useVault } from '../../context/VaultContext.jsx';
import { useProfile, useRoles } from '../../hooks/useProfile.js';
import { Button } from '../ui/Button.jsx';
import { Callout } from '../ui/Callout.jsx';
import { TextField } from '../ui/Form.jsx';
import { LogoMark } from '../ui/Logo.jsx';
import { Spinner } from '../ui/Spinner.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useQueryClient } from '@tanstack/react-query';
import { getContract, humanizeError } from '../../lib/contract.js';
import { getBytes } from 'ethers';
import { shortAddress } from '../../lib/format.js';

function GateFrame({ children }) {
  return (
    <div className="gate-shell">
      <Link to="/privacy" className="gate-brand" aria-label="About BlockTrack privacy">
        <LogoMark size={30} />
        <span className="brand-word" translate="no">
          Block<span>Track</span>
        </span>
      </Link>
      <div className="gate-card">{children}</div>
      <p className="gate-foot" style={{ maxWidth: 420, textAlign: 'center' }}>
        BlockTrack keeps shipment details encrypted in your browser. The chain
        stores ciphertext and public keys — never names, addresses, or notes.
      </p>
    </div>
  );
}

function GateLoading({ label = 'Preparing your workspace…' }) {
  return (
    <GateFrame>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'var(--ink-3)' }}>
        <Spinner />
        <span style={{ fontSize: 13 }}>{label}</span>
      </div>
    </GateFrame>
  );
}

function VaultGate() {
  const wallet = useWallet();
  const vault = useVault();
  const loading = vault.status === 'unlocking';

  return (
    <GateFrame>
      <div className="gate-icon" aria-hidden="true">
        <Lock />
      </div>
      <h1 className="gate-title">Unlock your encrypted shipments</h1>
      <p className="gate-text">
        Sign a short message to derive your vault key on this device. It is not a
        transaction, it costs no gas, and your private key never leaves your
        wallet.
      </p>

      {vault.error ? (
        <div style={{ marginTop: 16 }}>
          <Callout tone="danger" role="alert" title="Unlock failed">
            {vault.error}
          </Callout>
        </div>
      ) : null}

      <div className="gate-actions">
        <Button
          variant="primary"
          size="lg"
          onClick={vault.unlock}
          loading={loading}
          disabled={loading}
        >
          {loading ? 'Waiting for your wallet…' : 'Sign to unlock'}
        </Button>
        <Button variant="ghost" onClick={wallet.disconnect}>
          Use a different account
        </Button>
      </div>

      <div className="gate-foot">
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <ShieldCheck size={13} aria-hidden="true" />
          <span>No transaction</span>
          <span aria-hidden="true">·</span>
          <span>No gas</span>
          <span aria-hidden="true">·</span>
          <span>Key stays in this tab</span>
        </div>
        <div style={{ marginTop: 10 }}>
          <Link to="/privacy">
            How the encryption works <ArrowRight size={12} style={{ display: 'inline' }} />
          </Link>
        </div>
      </div>
    </GateFrame>
  );
}

function Onboarding({ profileQuery }) {
  const wallet = useWallet();
  const vault = useVault();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState(wallet.persona?.name || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter a display name.');
      return;
    }
    if (trimmed.length > 48) {
      setError('Use 48 characters or fewer.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const signer = wallet.assertCanWrite();
      const contract = getContract(
        wallet.deployment.contractAddress,
        signer
      );
      const tx = await contract.registerProfile(
        trimmed,
        getBytes(vault.publicKey)
      );
      await tx.wait();
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      await queryClient.invalidateQueries({ queryKey: ['profiles-list'] });
      await queryClient.invalidateQueries({ queryKey: ['roles'] });
      await profileQuery.refetch();
      toast.success('Profile created', 'Your encryption public key is registered on-chain.');
    } catch (cause) {
      const human = humanizeError(cause);
      setError(human.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <GateFrame>
      <div className="gate-icon" aria-hidden="true">
        <KeyRound />
      </div>
      <h1 className="gate-title">Set up your encrypted profile</h1>
      <p className="gate-text">
        Your wallet is connected and your vault is unlocked. Add a display name
        and register the public half of your encryption key. This is the only
        profile data stored on-chain.
      </p>

      <form onSubmit={submit} className="stack" style={{ marginTop: 18 }}>
        <TextField
          label="Display name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (error) setError('');
          }}
          placeholder="e.g. Rohan Mehta"
          maxLength={48}
          required
          autoFocus
          error={error || undefined}
          hint="Shown to the admin and assigned couriers. Keep it human-readable."
        />

        <div className="panel">
          <div className="kv">
            <span className="kv__label">Wallet</span>
            <span className="kv__value mono">{shortAddress(wallet.address)}</span>
          </div>
          <div className="kv">
            <span className="kv__label">Vault fingerprint</span>
            <span className="kv__value mono">{vault.fingerprint}</span>
          </div>
          <div className="kv">
            <span className="kv__label">Registration</span>
            <span className="kv__value">One transaction</span>
          </div>
        </div>

        <Callout tone="info" title="Only the public key is published">
          The private vault key stays in this browser tab. It is derived from
          your wallet signature and can be re-created later.
        </Callout>

        <Button type="submit" variant="primary" size="lg" loading={saving}>
          Create profile
        </Button>
        <Button variant="ghost" type="button" onClick={wallet.disconnect}>
          Use a different wallet
        </Button>
      </form>
    </GateFrame>
  );
}

function KeyMismatch() {
  const wallet = useWallet();
  const vault = useVault();
  const profileQuery = useProfile(wallet.address);
  const [retrying, setRetrying] = useState(false);

  const retry = async () => {
    setRetrying(true);
    await vault.unlock();
    await profileQuery.refetch();
    setRetrying(false);
  };

  return (
    <GateFrame>
      <div className="gate-icon" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>
        <AlertTriangle />
      </div>
      <h1 className="gate-title">This vault key doesn&apos;t match the profile</h1>
      <p className="gate-text">
        The address has a profile on-chain, but the key derived from this
        wallet&apos;s signature is different. This usually means the wallet
        produced a non-deterministic signature or the profile was created with a
        different signing method.
      </p>
      <div className="panel" style={{ marginTop: 16 }}>
        <div className="kv">
          <span className="kv__label">Registered key</span>
          <span className="kv__value mono">{shortAddress(profileQuery.data?.encryptionKey)}</span>
        </div>
        <div className="kv">
          <span className="kv__label">This browser</span>
          <span className="kv__value mono">{shortAddress(vault.publicKey)}</span>
        </div>
      </div>
      <div className="gate-actions">
        <Button variant="primary" onClick={retry} loading={retrying}>
          Try unlocking again
        </Button>
        <Button variant="ghost" onClick={wallet.disconnect}>
          Use a different wallet
        </Button>
      </div>
      <p className="gate-foot">
        Your old data is not lost — it is still encrypted to the original key.
        Use the wallet and signature method that created the profile, or read the
        privacy guide for recovery options.
      </p>
    </GateFrame>
  );
}

function GateError({ title, message, onRetry }) {
  const wallet = useWallet();
  return (
    <GateFrame>
      <div className="gate-icon" style={{ background: 'var(--red-soft)', color: 'var(--red)' }}>
        <AlertTriangle />
      </div>
      <h1 className="gate-title">{title}</h1>
      <p className="gate-text">{message}</p>
      <div className="gate-actions">
        <Button variant="primary" onClick={onRetry}>
          Retry
        </Button>
        <Button variant="ghost" onClick={wallet.disconnect}>
          Disconnect wallet
        </Button>
      </div>
    </GateFrame>
  );
}

export function RequireWallet() {
  const wallet = useWallet();
  const location = useLocation();

  if (!wallet.address || !wallet.signer) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }
  return <Outlet />;
}

export function RequireVault() {
  const vault = useVault();
  if (vault.isUnlocked) return <Outlet />;
  if (vault.status === 'unlocking') return <VaultGate />;
  return <VaultGate />;
}

export function RequireProfile() {
  const wallet = useWallet();
  const vault = useVault();
  const profileQuery = useProfile(wallet.address);

  if (profileQuery.isLoading) {
    return <GateLoading label="Loading your encrypted profile…" />;
  }
  if (profileQuery.error) {
    return (
      <GateError
        title="Could not load your profile"
        message={humanizeError(profileQuery.error).message}
        onRetry={() => profileQuery.refetch()}
      />
    );
  }
  if (!profileQuery.data?.exists) {
    return <Onboarding profileQuery={profileQuery} />;
  }
  if (
    vault.publicKey &&
    String(profileQuery.data.encryptionKey).toLowerCase() !==
      String(vault.publicKey).toLowerCase()
  ) {
    return <KeyMismatch />;
  }
  return <Outlet />;
}

export function RequireRole({ allow }) {
  const wallet = useWallet();
  const rolesQuery = useRoles(wallet.address);
  const outletContext = useOutletContext();

  if (rolesQuery.isLoading) {
    return <GateLoading label="Checking your permissions…" />;
  }
  if (rolesQuery.error) {
    return (
      <GateError
        title="Could not read your role"
        message={humanizeError(rolesQuery.error).message}
        onRetry={() => rolesQuery.refetch()}
      />
    );
  }
  if (!allow.includes(rolesQuery.data?.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet context={outletContext} />;
}
