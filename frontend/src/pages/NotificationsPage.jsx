import { Link, useOutletContext } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Button } from '../components/ui/Button.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { Callout } from '../components/ui/Callout.jsx';
import { SkeletonLines } from '../components/ui/Skeleton.jsx';
import { StatusBadge } from '../components/ui/Badges.jsx';
import { formatDateTime, formatRelative } from '../lib/format.js';

export function NotificationsPage() {
  const { notifications } = useOutletContext();
  const { items, unreadCount, markAllRead } = notifications;

  return (
    <div className="page">
      <PageHeader
        title="Notifications"
        subtitle="Status changes across the shipments you can access. Derived from chain events — no notification server."
        actions={
          <Button
            variant="secondary"
            icon={CheckCheck}
            onClick={markAllRead}
            disabled={!unreadCount}
          >
            Mark all read
          </Button>
        }
      />

      <Callout tone="info" title="Local to this browser">
        Read state is stored in your browser only. Notifications are rebuilt from
        the chain every time you open the app; nothing is sent to a server.
      </Callout>

      <div className="card">
        {items.length ? (
          <div className="notif-feed">
            {items.map((item) => {
              const unread = item.timestamp > notifications.lastSeen;
              return (
                <Link
                  key={item.key}
                  to={`/orders/${item.orderId}`}
                  className="notif-feed__item"
                >
                  <span
                    className={`notif-feed__icon ${unread ? 'notif-feed__icon--unread' : ''}`}
                  >
                    <Bell size={14} aria-hidden="true" />
                  </span>
                  <span className="notif-feed__body">
                    <span className="notif-feed__title">
                      {item.title}
                      {unread ? <span className="notif-feed__dot" aria-label="Unread" /> : null}
                    </span>
                    <span className="notif-feed__text">{item.body}</span>
                    <span className="notif-feed__meta">
                      <span className="mono">{item.orderId}</span>
                      <span aria-hidden="true">·</span>
                      <time dateTime={new Date(item.timestamp * 1000).toISOString()}>
                        {formatDateTime(item.timestamp)}
                      </time>
                      <span aria-hidden="true">·</span>
                      <span>{formatRelative(item.timestamp)}</span>
                    </span>
                  </span>
                  <span className="notif-feed__status">
                    <StatusBadge status={item.status} />
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={Bell}
            title="No activity yet"
            text="When an order is registered or moves to a new status, it will appear here."
          />
        )}
      </div>
    </div>
  );
}
