import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Database,
  EyeOff,
  Globe,
  KeyRound,
  Lock,
  ShieldCheck,
  Truck,
  User,
  Users,
} from 'lucide-react';
import { useWallet } from '../context/WalletContext.jsx';
import { usePageTitle } from '../hooks/usePageTitle.js';
import { Badge } from '../components/ui/Badges.jsx';
import { Callout } from '../components/ui/Callout.jsx';
import { shortAddress } from '../lib/format.js';

const STEPS = [
  {
    icon: Lock,
    title: 'Encrypt in the browser',
    body: 'Every order gets a fresh random 32-byte AES-256-GCM key. The payload is encrypted before any wallet prompt, with the tracking ID bound as additional authenticated data.',
  },
  {
    icon: KeyRound,
    title: 'Wrap the key for people',
    body: 'That order key is ECIES-wrapped to the customer and admin public keys. At dispatch, the admin unwraps it once and wraps it again for the assigned courier. Only wrapped keys go on-chain.',
  },
  {
    icon: Database,
    title: 'Anchor ciphertext on-chain',
    body: 'The contract stores the ciphertext, wrapped key envelopes, addresses, status history and timestamps. It never receives a name, phone number, street address, parcel description or note.',
  },
  {
    icon: EyeOff,
    title: 'Decrypt locally',
    body: 'Your vault key is derived from a signature inside this tab. It unwraps the order key and decrypts the payload locally. No server ever sees the plaintext or your private key.',
  },
];

export function PrivacyPage() {
  usePageTitle('How privacy works');
  const wallet = useWallet();

  return (
    <main className="public-main privacy-page">
      <div className="privacy-hero">
        <span className="eyebrow">Privacy model</span>
        <h1>Encryption is the access control.</h1>
        <p>
          BlockTrack doesn&apos;t hide data behind a login screen. It never puts
          readable shipment details on the chain in the first place. The chain
          holds the audit trail; your browser holds the key.
        </p>
        <div className="row row--wrap" style={{ marginTop: 18 }}>
          <Badge tone="green" icon={ShieldCheck}>
            No backend
          </Badge>
          <Badge tone="blue" icon={Lock}>
            AES-256-GCM
          </Badge>
          <Badge tone="violet" icon={KeyRound}>
            secp256k1 ECIES
          </Badge>
          <Badge tone="neutral" icon={Database}>
            On-chain audit trail
          </Badge>
        </div>
      </div>

      <section className="privacy-section" aria-labelledby="model-title">
        <div className="section__head">
          <div>
            <h2 className="section__title" id="model-title">
              The envelope model
            </h2>
            <p className="section__sub">
              Four steps, all of them in the browser except the immutable anchor.
            </p>
          </div>
        </div>
        <div className="privacy-grid">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <article className="privacy-step" key={step.title}>
                <div className="privacy-step__top">
                  <span className="privacy-step__num">0{index + 1}</span>
                  <span className="privacy-step__icon">
                    <Icon size={16} aria-hidden="true" />
                  </span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="privacy-section" aria-labelledby="visibility-title">
        <h2 className="section__title" id="visibility-title">
          What the chain sees
        </h2>
        <div className="privacy-split">
          <div className="card card--pad">
            <div className="row" style={{ marginBottom: 6 }}>
              <Globe size={15} aria-hidden="true" style={{ color: 'var(--ink-3)' }} />
              <h3 className="card__title">Public on-chain</h3>
            </div>
            <ul className="privacy-list">
              <li>Tracking ID and order existence</li>
              <li>Owner and assigned courier addresses</li>
              <li>Status transitions and timestamps</li>
              <li>Encrypted payload ciphertext</li>
              <li>Wrapped per-order key envelopes</li>
            </ul>
          </div>
          <div className="card card--pad">
            <div className="row" style={{ marginBottom: 6 }}>
              <EyeOff size={15} aria-hidden="true" style={{ color: 'var(--green)' }} />
              <h3 className="card__title">Encrypted, never readable</h3>
            </div>
            <ul className="privacy-list privacy-list--check">
              <li>Sender and recipient names</li>
              <li>Phone numbers and full addresses</li>
              <li>Parcel description, weight, declared value</li>
              <li>Special instructions</li>
              <li>Courier notes, locations and ETAs</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="privacy-section" aria-labelledby="access-title">
        <h2 className="section__title" id="access-title">
          Who can read what
        </h2>
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Access matrix for order data</caption>
              <thead>
                <tr>
                  <th scope="col">Role</th>
                  <th scope="col">Orders visible</th>
                  <th scope="col">Private details</th>
                  <th scope="col">How access is granted</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <span className="row" style={{ gap: 7 }}>
                      <User size={14} aria-hidden="true" /> Customer
                    </span>
                  </td>
                  <td>Own orders only</td>
                  <td>Full details of own orders</td>
                  <td>Owner key wrapped at creation</td>
                </tr>
                <tr>
                  <td>
                    <span className="row" style={{ gap: 7 }}>
                      <Truck size={14} aria-hidden="true" /> Courier
                    </span>
                  </td>
                  <td>Assigned orders only</td>
                  <td>Delivery-relevant details</td>
                  <td>Admin wraps the order key at assignment</td>
                </tr>
                <tr>
                  <td>
                    <span className="row" style={{ gap: 7 }}>
                      <Users size={14} aria-hidden="true" /> Admin
                    </span>
                  </td>
                  <td>All orders</td>
                  <td>Everything</td>
                  <td>Admin key wrapped at creation for operations</td>
                </tr>
                <tr>
                  <td>
                    <span className="row" style={{ gap: 7 }}>
                      <Globe size={14} aria-hidden="true" /> Public
                    </span>
                  </td>
                  <td>Status lookup by tracking ID</td>
                  <td>None</td>
                  <td>No key envelope exists</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="privacy-section" aria-labelledby="vault-title">
        <div className="privacy-split">
          <div>
            <h2 className="section__title" id="vault-title">
              Where the vault key comes from
            </h2>
            <p className="section__sub" style={{ marginTop: 8 }}>
              The wallet&apos;s private key is never used for encryption. It
              cannot be exported from a wallet, and ECDSA keys are not
              encryption keys. Instead:
            </p>
            <ol className="privacy-steps-list">
              <li>
                You sign a fixed, domain-separated message once per session.
                It is not a transaction and costs no gas.
              </li>
              <li>
                The signature is stretched with HKDF-SHA256 into a separate
                32-byte secp256k1 vault key.
              </li>
              <li>
                The public half is registered on-chain. The private half exists
                only in this tab and is re-derivable from the same signature.
              </li>
            </ol>
            <p className="field__hint" style={{ marginTop: 12 }}>
              Demo accounts auto-unlock because their keys are local and
              deterministic. A connected wallet asks for one signature per
              session.
            </p>
          </div>
          <div className="card card--pad privacy-code">
            <div className="eyebrow">Derivation</div>
            <pre>
{`signature = wallet.signMessage(VAULT_MESSAGE)

vaultKey = HKDF-SHA256(
  ikm  = signature,
  salt = "blocktrack.vault.v1",
  info = "secp256k1-aes256gcm",
  len  = 32
)

orderKey ⟵ ECIES-decrypt(
  wrappedKeyFor(you),
  vaultKey
)

payload ⟵ AES-GCM-decrypt(
  ciphertext,
  orderKey,
  aad = trackingId
)`}
            </pre>
          </div>
        </div>
      </section>

      <section className="privacy-section" aria-labelledby="limits-title">
        <h2 className="section__title" id="limits-title">
          The honest limits
        </h2>
        <div className="privacy-limits">
          <div className="privacy-limit">
            <AlertTriangle size={15} aria-hidden="true" />
            <div>
              <strong>Metadata is still public.</strong> The chain reveals that
              an address has an order, its status, and roughly how much
              ciphertext it holds.
            </div>
          </div>
          <div className="privacy-limit">
            <AlertTriangle size={15} aria-hidden="true" />
            <div>
              <strong>Lose the wallet, lose the data.</strong> There is no
              recovery server. A recoverable wallet plus a deterministic
              signature is the recovery path.
            </div>
          </div>
          <div className="privacy-limit">
            <AlertTriangle size={15} aria-hidden="true" />
            <div>
              <strong>Revocation is not retroactive.</strong> Reassigning a
              courier removes their on-chain grant, but someone who already
              decrypted could keep a copy. True revocation needs key rotation.
            </div>
          </div>
          <div className="privacy-limit">
            <AlertTriangle size={15} aria-hidden="true" />
            <div>
              <strong>The admin is trusted.</strong> Operations holds a wrapped
              key for every order. That is necessary for dispatch and support,
              and it is a real trust boundary.
            </div>
          </div>
          <div className="privacy-limit">
            <AlertTriangle size={15} aria-hidden="true" />
            <div>
              <strong>On-chain storage costs gas.</strong> This demo stores
              ciphertext directly. A production build would put ciphertext on
              IPFS/Arweave and anchor only the CID and checksum.
            </div>
          </div>
          <div className="privacy-limit">
            <AlertTriangle size={15} aria-hidden="true" />
            <div>
              <strong>This is a PoC, not an audit.</strong> The primitives are
              standard, but get a review before any real customer data is used.
            </div>
          </div>
        </div>
      </section>

      <Callout tone="info" title="Local demo">
        This contract is deployed on Anvil chain {wallet.deployment.chainId} at{' '}
        <span className="mono">{shortAddress(wallet.deployment.contractAddress)}</span>.
        Demo accounts use public Anvil test keys and must never be used on a real
        network.
      </Callout>

      <div className="privacy-cta">
        <div>
          <h2>See the whole flow.</h2>
          <p>Sign in with a demo customer, admin, or courier account.</p>
        </div>
        <div className="row row--wrap">
          <Link to="/track" className="btn btn--secondary">
            Track a shipment
          </Link>
          <Link to={wallet.address ? '/dashboard' : '/login'} className="btn btn--primary">
            {wallet.address ? 'Open app' : 'Sign in'}
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </main>
  );
}
