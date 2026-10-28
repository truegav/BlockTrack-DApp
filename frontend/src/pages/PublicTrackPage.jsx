import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Lock,
  Package,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { usePublicOrder } from '../hooks/useOrders.js';
import { usePageTitle } from '../hooks/usePageTitle.js';
import { humanizeError } from '../lib/contract.js';
import { formatDateTime, formatRelative } from '../lib/format.js';
import { normalizeTrackingId } from '../lib/ids.js';
import { StatusBadge } from '../components/ui/Badges.jsx';
import { Callout } from '../components/ui/Callout.jsx';
import { CopyButton } from '../components/ui/CopyButton.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { OrderProgress } from '../components/domain/OrderProgress.jsx';
import { PublicTimeline } from '../components/domain/OrderTimeline.jsx';

const SAMPLE_ID = 'BT-7K4M2Q';

export function PublicTrackPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [value, setValue] = useState(id || '');
  const query = usePublicOrder(id);

  usePageTitle(id ? `Track ${id}` : 'Track a shipment');

  useEffect(() => {
    setValue(id || '');
  }, [id]);

  const submit = (event) => {
    event.preventDefault();
    const normalized = normalizeTrackingId(value);
    if (!normalized) return;
    navigate(`/track/${encodeURIComponent(normalized)}`);
  };

  const sample = () => {
    setValue(SAMPLE_ID);
    navigate(`/track/${SAMPLE_ID}`);
  };

  return (
    <main className="public-main">
      {!id ? (
        <div className="public-hero">
          <span className="eyebrow">Public tracking</span>
          <h1 className="public-hero__title">Where is your shipment?</h1>
          <p className="public-hero__sub">
            Enter a tracking ID to see the status and immutable timeline. Names,
            phone numbers, addresses and courier notes stay encrypted — this page
            can&apos;t read them.
          </p>
        </div>
      ) : (
        <div className="public-hero" style={{ maxWidth: 760, marginBottom: 8 }}>
          <Link className="back-link" to="/track" style={{ justifyContent: 'center' }}>
            New search
          </Link>
          <h1 className="public-hero__title" style={{ fontSize: 30 }}>
            Shipment status
          </h1>
        </div>
      )}

      <form className="track-form" onSubmit={submit} style={{ maxWidth: 620, margin: '26px auto 0' }}>
        <label className="sr-only" htmlFor="public-tracking-id">
          Tracking ID
        </label>
        <input
          id="public-tracking-id"
          className="input"
          value={value}
          onChange={(event) => setValue(event.target.value.toUpperCase())}
          placeholder="BT-7K4M2Q"
          autoComplete="off"
          spellCheck="false"
          autoCapitalize="characters"
          maxLength={32}
          enterKeyHint="search"
        />
        <button type="submit" className="btn btn--primary" disabled={!value.trim()}>
          <Search size={15} aria-hidden="true" />
          <span>Track</span>
        </button>
      </form>

      <div className="row" style={{ justifyContent: 'center', marginTop: 12, gap: 6 }}>
        <span className="field__hint">Try the demo ID</span>
        <button type="button" className="btn btn--link" onClick={sample}>
          {SAMPLE_ID}
        </button>
      </div>

      {id ? (
        <section className="public-result" aria-live="polite">
          {query.isLoading ? (
            <div className="card card--pad">
              <Skeleton width={160} height={20} />
              <div style={{ marginTop: 14 }}>
                <Skeleton width="100%" height={4} />
              </div>
              <div style={{ marginTop: 26 }} className="stack">
                {Array.from({ length: 4 }, (_, index) => (
                  <div className="row" key={index} style={{ gap: 12 }}>
                    <Skeleton width={24} height={24} circle />
                    <div style={{ flex: 1 }}>
                      <Skeleton width="42%" height={12} />
                      <div style={{ marginTop: 6 }}>
                        <Skeleton width="26%" height={9} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : query.error ? (
            <div className="card">
              <div className="empty">
                <div className="empty__art" style={{ background: 'var(--red-soft)', borderColor: 'transparent', color: 'var(--red)' }}>
                  <AlertTriangle />
                </div>
                <h2 className="empty__title">No shipment found</h2>
                <p className="empty__text">
                  {humanizeError(query.error).message} Check the ID or ask the
                  sender to confirm it.
                </p>
                <div className="empty__actions">
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={() => navigate('/track')}
                  >
                    Clear search
                  </button>
                  <Link to="/login" className="btn btn--ghost">
                    Sign in <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>
          ) : query.data ? (
            <>
              <div className="card">
                <div className="card__header" style={{ alignItems: 'center' }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <span className="table__id" style={{ fontSize: 17 }} translate="no">
                        {query.data.id}
                      </span>
                      <CopyButton value={query.data.id} label="Copy tracking ID" />
                    </div>
                    <div className="card__subtitle">
                      Registered {formatDateTime(query.data.createdAt)} · updated{' '}
                      {formatRelative(query.data.updatedAt)}
                    </div>
                  </div>
                  <StatusBadge status={query.data.status} />
                </div>
                <div className="card__body">
                  <OrderProgress status={query.data.status} />
                  <hr className="divider" style={{ margin: '24px 0' }} />
                  <div className="section__head" style={{ marginBottom: 14 }}>
                    <div>
                      <h2 className="section__title">Timeline</h2>
                      <p className="section__sub">
                        Status transitions are written by the contract. They
                        cannot be edited.
                      </p>
                    </div>
                    <span className="badge badge--green">
                      <ShieldCheck size={11} aria-hidden="true" />
                      On-chain
                    </span>
                  </div>
                  <PublicTimeline history={query.data.history} />
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <Callout tone="info" title="This view is deliberately limited">
                  Anyone with the tracking ID can see status and timestamps. To
                  read names, addresses, parcel details or courier notes, the
                  owner, assigned courier, or an admin must decrypt them with
                  their vault key.
                </Callout>
              </div>

              <div className="row row--between" style={{ marginTop: 18, flexWrap: 'wrap', gap: 10 }}>
                <span className="chain-status">
                  <Lock size={13} aria-hidden="true" />
                  Personal details are encrypted
                </span>
                <Link to="/login" className="btn btn--secondary">
                  Sign in for full details
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            </>
          ) : null}
        </section>
      ) : (
        <div className="public-hero" style={{ marginTop: 42 }}>
          <div
            className="card card--pad"
            style={{ textAlign: 'left', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 14 }}
          >
            <span className="empty__art" style={{ margin: 0, width: 48, height: 48 }}>
              <Package size={20} />
            </span>
            <div>
              <h2 className="card__title">Status-only tracking</h2>
              <p className="card__subtitle" style={{ marginTop: 4 }}>
                The public page reads only the status getter. It has no key
                envelope and therefore cannot decrypt the shipment payload.
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
