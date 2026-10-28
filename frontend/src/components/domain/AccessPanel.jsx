import { KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { useWallet } from '../../context/WalletContext.jsx';
import { shortAddress } from '../../lib/format.js';
import { Entity } from '../ui/Identity.jsx';

function roleFor(order, address) {
  const lower = address?.toLowerCase();
  if (order.owner?.toLowerCase() === lower) return 'Owner';
  if (order.courier?.toLowerCase() === lower) return 'Courier';
  return 'Operations';
}

export function AccessPanel({ order, profiles = {} }) {
  const wallet = useWallet();
  const holders = order.keyHolders?.length
    ? order.keyHolders
    : [order.owner, order.courier].filter(Boolean);
  const current = wallet.address?.toLowerCase();

  return (
    <section className="card" aria-labelledby="access-title">
      <div className="card__header">
        <div>
          <h2 className="card__title" id="access-title">
            Who can read this
          </h2>
          <p className="card__subtitle">
            Each person below holds this order key, wrapped to their own vault
            public key.
          </p>
        </div>
        <Lock size={15} aria-label="Encrypted" style={{ color: 'var(--ink-3)' }} />
      </div>
      <div className="card__body">
        <ul className="access-list">
          {holders.map((address) => {
            const profile = profiles[address.toLowerCase()];
            const role = roleFor(order, address);
            return (
              <li className="access-list__item" key={address}>
                <Entity
                  address={address}
                  name={profile?.displayName || shortAddress(address)}
                  size="sm"
                />
                <span className={`badge ${role === 'Owner' ? 'badge--blue' : role === 'Courier' ? 'badge--violet' : 'badge--neutral'}`}>
                  {role}
                </span>
                {address.toLowerCase() === current ? (
                  <span className="tag">You</span>
                ) : null}
              </li>
            );
          })}
        </ul>
        <div className="callout" style={{ marginTop: 14 }}>
          <KeyRound size={15} aria-hidden="true" />
          <div>
            <div className="callout__title">Envelope model</div>
            <div className="callout__body">
              The chain stores ciphertext and key envelopes, never plaintext. A
              courier receives the key only when the admin assigns the order.
            </div>
          </div>
        </div>
        <div className="row" style={{ marginTop: 10, color: 'var(--green)', fontSize: 11.5 }}>
          <ShieldCheck size={13} aria-hidden="true" />
          <span>Your vault decrypted this view locally.</span>
        </div>
      </div>
    </section>
  );
}
