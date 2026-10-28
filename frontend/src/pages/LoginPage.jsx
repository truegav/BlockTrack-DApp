import { Link, Navigate, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  KeyRound,
  Lock,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { useWallet } from '../context/WalletContext.jsx';
import { usePageTitle } from '../hooks/usePageTitle.js';
import { roleLabel } from '../shared/personas.js';
import { Avatar } from '../components/ui/Avatar.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Callout } from '../components/ui/Callout.jsx';
import { Logo } from '../components/ui/Logo.jsx';
import { ThemeToggle } from '../components/ui/ThemeToggle.jsx';
import { shortAddress } from '../lib/format.js';

function PrivacyDiagram() {
  return (
    <svg
      viewBox="0 0 460 190"
      role="img"
      aria-label="Details are encrypted in the browser, stored on-chain as ciphertext, and opened only with a vault key."
    >
      <g fill="none" stroke="rgba(255,255,255,0.38)" strokeWidth="1.2">
        <rect x="8" y="34" width="126" height="104" rx="12" fill="rgba(255,255,255,0.035)" />
        <rect x="167" y="34" width="126" height="104" rx="12" fill="rgba(255,255,255,0.035)" />
        <rect x="326" y="34" width="126" height="104" rx="12" fill="rgba(255,255,255,0.035)" />
        <path d="M134 86h32M293 86h32" strokeDasharray="3 4" />
        <circle cx="152" cy="86" r="2.4" fill="#9cc4ff" stroke="none" />
        <circle cx="311" cy="86" r="2.4" fill="#9cc4ff" stroke="none" />
      </g>

      <g transform="translate(48 60)" stroke="rgba(255,255,255,0.72)" strokeWidth="1.5" fill="none">
        <rect x="0" y="14" width="46" height="34" rx="7" />
        <path d="M10 14V9a13 13 0 0 1 26 0v5" />
        <circle cx="23" cy="31" r="3" fill="#9cc4ff" stroke="none" />
        <path d="M23 34v6" />
      </g>
      <g transform="translate(202 60)" stroke="rgba(255,255,255,0.72)" strokeWidth="1.4" fill="none">
        <rect x="0" y="6" width="26" height="26" rx="4" />
        <rect x="18" y="26" width="26" height="26" rx="4" />
        <rect x="36" y="46" width="26" height="26" rx="4" />
        <path d="M26 19h10M44 39h10" strokeDasharray="2 3" />
        <circle cx="13" cy="19" r="1.6" fill="#9cc4ff" stroke="none" />
        <circle cx="31" cy="39" r="1.6" fill="#9cc4ff" stroke="none" />
        <circle cx="49" cy="59" r="1.6" fill="#9cc4ff" stroke="none" />
      </g>
      <g transform="translate(360 58)" stroke="rgba(255,255,255,0.72)" strokeWidth="1.5" fill="none">
        <circle cx="20" cy="20" r="12" />
        <path d="M29 29 46 46M38 38l6-6M44 44l6-6" />
        <circle cx="20" cy="20" r="3" fill="#9cc4ff" stroke="none" />
      </g>

      <g fontFamily="IBM Plex Sans, sans-serif" fontSize="10.5" fill="rgba(255,255,255,0.58)">
        <text x="71" y="158" textAnchor="middle">Your details</text>
        <text x="230" y="158" textAnchor="middle">Ciphertext on-chain</text>
        <text x="389" y="158" textAnchor="middle">Your vault key</text>
        <text x="71" y="173" textAnchor="middle" fill="rgba(255,255,255,0.34)">AES-256-GCM</text>
        <text x="230" y="173" textAnchor="middle" fill="rgba(255,255,255,0.34)">wrapped keys</text>
        <text x="389" y="173" textAnchor="middle" fill="rgba(255,255,255,0.34)">stays local</text>
      </g>
    </svg>
  );
}

export function LoginPage() {
  usePageTitle('Sign in');
  const wallet = useWallet();
  const location = useLocation();
  const from = location.state?.from;
  const target = from && from !== '/login' ? from : '/dashboard';

  if (wallet.address && wallet.signer) {
    return <Navigate to={target} replace />;
  }

  return (
    <div className="auth-shell">
      <section className="auth-visual" aria-label="About BlockTrack">
        <Logo to="/login" tone="light" />
        <div className="auth-visual__content">
          <span className="auth-visual__eyebrow">
            <ShieldCheck size={12} aria-hidden="true" />
            Privacy-preserving logistics
          </span>
          <h1 className="auth-visual__headline">
            Tracking you can verify.
            <br />
            <em>Details only you can read.</em>
          </h1>
          <p className="auth-visual__lead">
            Shipment records are encrypted in your browser before they touch the
            chain. Status changes are immutable and auditable; names, addresses
            and notes never leave your vault.
          </p>
          <ul className="auth-visual__features">
            <li className="auth-visual__feature">
              <Lock aria-hidden="true" />
              <span>
                <strong>Encrypted before it leaves the tab</strong>
                AES-256-GCM with a fresh key for every order.
              </span>
            </li>
            <li className="auth-visual__feature">
              <KeyRound aria-hidden="true" />
              <span>
                <strong>Your wallet is the identity</strong>
                A vault key is derived from a signature; the private key never
                leaves your wallet.
              </span>
            </li>
            <li className="auth-visual__feature">
              <Check aria-hidden="true" />
              <span>
                <strong>Only the right people get keys</strong>
                You, operations, and the assigned courier — never the public.
              </span>
            </li>
          </ul>
        </div>
        <div className="auth-visual__diagram">
          <PrivacyDiagram />
        </div>
      </section>

      <section className="auth-panel">
        <div style={{ position: 'absolute', top: 18, right: 18 }}>
          <ThemeToggle />
        </div>
        <div className="auth-card">
          <div className="auth-card__head">
            <h2 className="auth-card__title">Sign in</h2>
            <p className="auth-card__sub">
              Use a demo account to walk through the full flow, or connect a
              browser wallet. No passwords, no server.
            </p>
          </div>

          {wallet.error ? (
            <div style={{ marginBottom: 16 }}>
              <Callout tone="danger" role="alert" title="Could not sign in">
                {wallet.error}
              </Callout>
            </div>
          ) : null}

          {wallet.chainError ? (
            <div style={{ marginBottom: 16 }}>
              <Callout
                tone="warning"
                title="Local chain not reachable"
                action={
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={wallet.retryChain}
                    loading={wallet.chainChecking}
                  >
                    Retry
                  </Button>
                }
              >
                {wallet.chainError}
              </Callout>
            </div>
          ) : null}

          {wallet.demoEnabled ? (
            <>
              <div className="auth-card__section-label">
                <span>Demo accounts</span>
                <span className="demo-chip">Local · Anvil</span>
              </div>
              <div className="persona-grid">
                {wallet.demoPersonas.map((persona) => (
                  <button
                    key={persona.id}
                    type="button"
                    className="persona-card"
                    onClick={() => wallet.connectDemo(persona.id)}
                    disabled={wallet.connecting}
                  >
                    <Avatar name={persona.name} address={persona.address} />
                    <span className="persona-card__body">
                      <span className="persona-card__name">{persona.name}</span>
                      <span className="persona-card__role">
                        {persona.role === 'admin' ? 'Admin · Operations' : persona.title}
                      </span>
                    </span>
                    <ArrowRight className="persona-card__arrow" aria-hidden="true" />
                  </button>
                ))}
              </div>
              <div className="auth-divider">or</div>
            </>
          ) : null}

          <Button
            variant={wallet.demoEnabled ? 'secondary' : 'primary'}
            size="lg"
            block
            icon={Wallet}
            loading={wallet.connecting}
            onClick={wallet.connectInjected}
          >
            Connect a wallet
          </Button>
          {!window.ethereum ? (
            <p className="field__hint" style={{ marginTop: 8, textAlign: 'center' }}>
              No browser wallet detected. Demo accounts work without MetaMask.
            </p>
          ) : null}

          <div className="auth-meta">
            <span className="chain-status">
              <span className="dot" aria-hidden="true" />
              {wallet.chainError ? 'Chain unreachable' : `Anvil · chain ${wallet.deployment.chainId}`}
            </span>
            <Link className="btn btn--link" to="/track">
              Track a shipment <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>

          <div className="auth-footnote">
            {wallet.demoEnabled
              ? 'Demo mode uses publicly known Anvil test keys. They hold no value and are only available on chain 31337.'
              : `Contract ${shortAddress(wallet.deployment.contractAddress)} · keys stay in your browser.`}
          </div>
        </div>
      </section>
    </div>
  );
}
