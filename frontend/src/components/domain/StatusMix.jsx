import { ORDER_STATUSES } from '../../lib/status.js';
import { StatusBadge } from '../ui/Badges.jsx';

const TONE_COLORS = {
  created: 'var(--slate)',
  'picked-up': 'var(--blue)',
  'in-transit': 'var(--amber)',
  'out-for-delivery': 'var(--violet)',
  delivered: 'var(--green)',
  failed: 'var(--red)',
  cancelled: 'var(--slate)',
};

export function StatusMix({ orders }) {
  const total = orders.length || 1;

  return (
    <div className="status-mix">
      {ORDER_STATUSES.map((status) => {
        const count = orders.filter((order) => order.status === status.key).length;
        return (
          <div className="status-mix__row" key={status.key}>
            <StatusBadge status={status.key} />
            <span className="status-mix__meter">
              <span
                className="status-mix__fill"
                style={{
                  width: `${Math.max(count ? 3 : 0, (count / total) * 100)}%`,
                  background: TONE_COLORS[status.tone],
                }}
              />
            </span>
            <span className="status-mix__count tabular">{count}</span>
          </div>
        );
      })}
    </div>
  );
}
