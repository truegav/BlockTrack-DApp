import { CalendarClock, MapPin, ShieldCheck, UserCheck } from 'lucide-react';
import { formatDateTime, formatRelative, shortAddress } from '../../lib/format.js';
import { statusMeta } from '../../lib/status.js';

function actorName(profiles, address) {
  if (!address) return 'Unknown';
  const profile = profiles?.[address.toLowerCase()];
  return profile?.displayName || shortAddress(address);
}

function noteChips(note) {
  if (!note) return null;
  const chips = [];
  if (note.location) {
    chips.push(
      <span className="timeline__chip" key="location">
        <MapPin aria-hidden="true" />
        {note.location}
      </span>
    );
  }
  if (note.eta) {
    chips.push(
      <span className="timeline__chip" key="eta">
        <CalendarClock aria-hidden="true" />
        ETA {formatDateTime(note.eta)}
      </span>
    );
  }
  if (note.receivedBy) {
    chips.push(
      <span className="timeline__chip" key="received">
        <UserCheck aria-hidden="true" />
        Signed by {note.receivedBy}
      </span>
    );
  }
  if (note.reason) {
    chips.push(
      <span className="timeline__chip" key="reason">
        {note.reason}
      </span>
    );
  }
  return chips.length ? <div className="timeline__chips">{chips}</div> : null;
}

export function OrderTimeline({ history = [], profiles = {}, emptyText }) {
  if (!history.length) {
    return <p className="field__hint">{emptyText || 'No status updates yet.'}</p>;
  }

  const ordered = [...history].reverse();

  return (
    <ol className="timeline">
      {ordered.map((update, index) => {
        const meta = statusMeta(update.status);
        const Icon = meta.icon;
        const isInitial =
          update.status === 'Created' &&
          index === ordered.length - 1 &&
          !update.note;
        const note = update.note;
        return (
          <li className="timeline__item" key={`${update.timestamp}-${update.status}-${index}`}>
            <div className="timeline__rail">
              <span className={`timeline__dot timeline__dot--${meta.tone}`}>
                <Icon aria-hidden="true" />
              </span>
              {index < ordered.length - 1 ? (
                <span className="timeline__line" aria-hidden="true" />
              ) : null}
            </div>
            <div className="timeline__body">
              <div className="timeline__title">
                <span>{isInitial ? 'Order registered' : meta.label}</span>
                {isInitial ? (
                  <span className="badge badge--outline">
                    <ShieldCheck size={11} aria-hidden="true" />
                    On-chain
                  </span>
                ) : null}
              </div>
              <div className="timeline__meta">
                <span>{formatDateTime(update.timestamp)}</span>
                <span aria-hidden="true">·</span>
                <span>{formatRelative(update.timestamp)}</span>
                {update.actor ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{actorName(profiles, update.actor)}</span>
                  </>
                ) : null}
              </div>

              {update.noteError ? (
                <div className="timeline__note" style={{ color: 'var(--amber)' }}>
                  This update is encrypted with a key this browser doesn&apos;t
                  hold. Ask the sender or admin for access.
                </div>
              ) : note?.note ? (
                <div className="timeline__note">{note.note}</div>
              ) : isInitial ? (
                <div className="timeline__note">
                  Encrypted order registered on-chain. The payload is visible
                  only to authorised keys.
                </div>
              ) : null}

              {!update.noteError && note ? noteChips(note) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function PublicTimeline({ history = [] }) {
  if (!history.length) {
    return <p className="field__hint">No status updates yet.</p>;
  }
  const ordered = [...history].reverse();
  return (
    <ol className="timeline">
      {ordered.map((update, index) => {
        const meta = statusMeta(update.status);
        const Icon = meta.icon;
        return (
          <li className="timeline__item" key={`${update.timestamp}-${index}`}>
            <div className="timeline__rail">
              <span className={`timeline__dot timeline__dot--${meta.tone}`}>
                <Icon aria-hidden="true" />
              </span>
              {index < ordered.length - 1 ? (
                <span className="timeline__line" aria-hidden="true" />
              ) : null}
            </div>
            <div className="timeline__body">
              <div className="timeline__title">
                {index === ordered.length - 1 ? 'Order registered' : meta.label}
              </div>
              <div className="timeline__meta">
                <span>{formatDateTime(update.timestamp)}</span>
                <span aria-hidden="true">·</span>
                <span>{formatRelative(update.timestamp)}</span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
