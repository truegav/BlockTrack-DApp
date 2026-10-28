import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { formatRelative } from '../../lib/format.js';
import { statusMeta } from '../../lib/status.js';

export function ActivityList({ items = [], limit = 6 }) {
  const list = items.slice(0, limit);
  if (!list.length) {
    return (
      <p className="field__hint">
        Status changes and new orders will appear here.
      </p>
    );
  }

  return (
    <ul className="activity-list">
      {list.map((item) => {
        const meta = statusMeta(item.status);
        const Icon = meta.icon;
        return (
          <li key={item.key}>
            <Link to={`/orders/${item.orderId}`} className="activity-item">
              <span className={`activity-item__icon activity-item__icon--${meta.tone}`}>
                <Icon size={13} aria-hidden="true" />
              </span>
              <span className="activity-item__body">
                <span className="activity-item__title">{item.title}</span>
                <span className="activity-item__text">{item.body}</span>
                <span className="activity-item__meta">
                  <span className="mono">{item.orderId}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatRelative(item.timestamp)}</span>
                </span>
              </span>
              <ArrowUpRight size={13} aria-hidden="true" className="activity-item__arrow" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
