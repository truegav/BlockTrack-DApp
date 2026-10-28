import { useMemo } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  MapPin,
  Package,
  Plus,
  ShieldCheck,
  Truck,
  Users,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Callout } from '../components/ui/Callout.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { PageSkeleton } from '../components/ui/Skeleton.jsx';
import { StatCard } from '../components/ui/StatCard.jsx';
import { Button } from '../components/ui/Button.jsx';
import { StatusBadge } from '../components/ui/Badges.jsx';
import { OrderCard } from '../components/domain/OrderCard.jsx';
import { OrderProgress } from '../components/domain/OrderProgress.jsx';
import { ActivityList } from '../components/domain/ActivityList.jsx';
import { StatusMix } from '../components/domain/StatusMix.jsx';
import { VolumeChart } from '../components/domain/VolumeChart.jsx';
import { useProfiles } from '../hooks/useProfile.js';
import { useOrderStats } from '../hooks/useOrders.js';
import {
  formatDate,
  formatDateTime,
  formatRelative,
  shortAddress,
  timeOfDayGreeting,
} from '../lib/format.js';
import { isFinalStatus } from '../lib/status.js';

const ZERO = '0x0000000000000000000000000000000000000000';
const PRIORITY = {
  OutForDelivery: 0,
  InTransit: 1,
  PickedUp: 2,
  FailedAttempt: 3,
  Created: 4,
};

function startOfToday() {
  const now = new Date();
  return Math.floor(
    new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000
  );
}

function NextDelivery({ order, profiles }) {
  if (!order) {
    return (
      <EmptyState
        icon={Package}
        title="No active shipments"
        text="Create an order and it will appear here once it is registered on-chain."
        action={
          <Link to="/orders/new" className="btn btn--primary">
            <Plus size={15} aria-hidden="true" />
            New order
          </Link>
        }
      />
    );
  }

  const recipient = order.payload?.recipient;
  const sender = order.payload?.sender;
  const latestWithEta = [...(order.history ?? [])]
    .reverse()
    .find((update) => update.note?.eta);
  const courier = profiles[order.courier?.toLowerCase()];

  return (
    <div className="next-delivery">
      <div className="next-delivery__top">
        <div>
          <div className="next-delivery__name">
            {recipient?.name || 'Encrypted recipient'}
          </div>
          <div className="next-delivery__route">
            <MapPin size={13} aria-hidden="true" />
            {sender?.city} → {recipient?.city}
          </div>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="next-delivery__progress">
        <OrderProgress status={order.status} compact />
      </div>

      <div className="next-delivery__meta">
        <div>
          <span className="eyebrow">ETA</span>
          <div className="next-delivery__value">
            {latestWithEta?.note?.eta
              ? formatDateTime(latestWithEta.note.eta)
              : 'Not shared yet'}
          </div>
        </div>
        <div>
          <span className="eyebrow">Courier</span>
          <div className="next-delivery__value">
            {order.courier && order.courier !== ZERO
              ? courier?.displayName || shortAddress(order.courier)
              : 'Awaiting dispatch'}
          </div>
        </div>
        <div>
          <span className="eyebrow">Updated</span>
          <div className="next-delivery__value">
            {formatRelative(order.updatedAt)}
          </div>
        </div>
        <Link to={`/orders/${order.id}`} className="btn btn--secondary btn--sm">
          View shipment <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

function DispatchList({ orders, profiles }) {
  if (!orders.length) {
    return (
      <EmptyState
        icon={Check}
        title="Everything is dispatched"
        text="There are no unassigned active orders. New orders will appear here automatically."
      />
    );
  }

  return (
    <ul className="dispatch-list">
      {orders.slice(0, 6).map((order) => (
        <li key={order.id}>
          <Link to={`/orders/${order.id}`} className="dispatch-list__item">
            <span className="activity-item__icon activity-item__icon--created">
              <Package size={13} aria-hidden="true" />
            </span>
            <span className="dispatch-list__body">
              <span className="dispatch-list__title">
                <span className="mono">{order.id}</span>
                <StatusBadge status={order.status} />
              </span>
              <span className="dispatch-list__sub">
                {order.payload?.recipient?.name || 'Encrypted recipient'} ·{' '}
                {order.payload?.recipient?.city || 'Unknown city'} ·{' '}
                {formatRelative(order.createdAt)}
              </span>
            </span>
            <span className="dispatch-list__action">
              Assign <ArrowRight size={13} aria-hidden="true" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function DashboardPage() {
  const { session, ordersState, notifications } = useOutletContext();
  const { wallet, role, name } = session;
  const { orders, isLoading, error } = ordersState;
  const stats = useOrderStats(orders);
  const today = startOfToday();

  const addresses = useMemo(
    () =>
      orders.flatMap((order) =>
        [order.owner, order.courier].filter(
          (address) => address && address !== ZERO
        )
      ),
    [orders]
  );
  const { data: profiles } = useProfiles(addresses);

  const active = orders.filter((order) => !isFinalStatus(order.status));
  const unassigned = active.filter(
    (order) => !order.courier || order.courier === ZERO
  );
  const deliveredToday = orders.filter(
    (order) => order.status === 'Delivered' && order.updatedAt >= today
  );
  const sortedActive = [...active].sort(
    (a, b) =>
      (PRIORITY[a.status] ?? 9) - (PRIORITY[b.status] ?? 9) ||
      b.updatedAt - a.updatedAt
  );
  const nextOrder = sortedActive[0] || null;
  const firstName = name.split(' ')[0];
  const greeting = `${timeOfDayGreeting()}, ${firstName}`;

  if (isLoading && !orders.length) {
    return <PageSkeleton title="Loading overview" />;
  }

  const actions =
    role === 'admin' ? (
      <>
        <Link to="/dispatch" className="btn btn--secondary">
          <Truck size={15} aria-hidden="true" />
          Dispatch
        </Link>
        <Link to="/orders/new" className="btn btn--primary">
          <Plus size={15} aria-hidden="true" />
          Register order
        </Link>
      </>
    ) : role === 'courier' ? (
      <Link to="/queue" className="btn btn--primary">
        <Truck size={15} aria-hidden="true" />
        Open delivery queue
      </Link>
    ) : (
      <>
        <Link to="/track" className="btn btn--secondary">
          <MapPin size={15} aria-hidden="true" />
          Track by ID
        </Link>
        <Link to="/orders/new" className="btn btn--primary">
          <Plus size={15} aria-hidden="true" />
          New order
        </Link>
      </>
    );

  return (
    <div className="page">
      <PageHeader
        title={greeting}
        docTitle="Overview"
        subtitle={`${formatDate(new Date())} · ${
          role === 'admin'
            ? 'Operations across every shipment.'
            : role === 'courier'
              ? 'Your assigned deliveries and what needs action.'
              : 'Your shipments, encrypted and tracked.'
        }`}
        actions={actions}
      />

      {error ? (
        <Callout tone="danger" title="Could not load shipments">
          {error.shortMessage || error.message}
        </Callout>
      ) : null}

      {role === 'admin' ? (
        <>
          <div className="stat-grid">
            <StatCard label="Active" value={stats.active} meta="Not final yet" icon={Package} tone="accent" />
            <StatCard label="Unassigned" value={stats.unassigned} meta="Waiting for dispatch" icon={Truck} tone={stats.unassigned ? 'warn' : undefined} />
            <StatCard label="Delivered · 7d" value={stats.delivered7d} meta="Completed recently" icon={Check} tone="success" />
            <StatCard label="Exceptions" value={stats.failed} meta="Failed attempts" icon={AlertTriangle} tone={stats.failed ? 'danger' : undefined} />
          </div>

          <div className="dashboard-grid">
            <div className="stack">
              <section className="card">
                <div className="card__header">
                  <div>
                    <h2 className="card__title">Needs dispatch</h2>
                    <p className="card__subtitle">Active orders without a courier.</p>
                  </div>
                  <Link to="/dispatch" className="btn btn--link">
                    Open dispatch <ArrowRight size={13} aria-hidden="true" />
                  </Link>
                </div>
                <DispatchList orders={unassigned} profiles={profiles} />
              </section>

              <section className="card">
                <div className="card__header">
                  <div>
                    <h2 className="card__title">Order volume</h2>
                    <p className="card__subtitle">Created over the last 14 days.</p>
                  </div>
                </div>
                <div className="card__body">
                  <VolumeChart orders={orders} />
                </div>
              </section>
            </div>

            <div className="stack">
              <section className="card">
                <div className="card__header">
                  <h2 className="card__title">Recent activity</h2>
                </div>
                <div className="card__body">
                  <ActivityList items={notifications.items} limit={7} />
                </div>
              </section>

              <section className="card">
                <div className="card__header">
                  <div>
                    <h2 className="card__title">Status mix</h2>
                    <p className="card__subtitle">All accessible orders.</p>
                  </div>
                </div>
                <div className="card__body">
                  <StatusMix orders={orders} />
                </div>
              </section>

              <Callout tone="info" title="Privacy boundary">
                Decryption happens in this tab. The admin holds a wrapped key for
                every order, but no server stores plaintext.
              </Callout>
            </div>
          </div>
        </>
      ) : role === 'courier' ? (
        <>
          <div className="stat-grid">
            <StatCard label="Assigned" value={active.length} meta="Active shipments" icon={Truck} tone="accent" />
            <StatCard label="Out for delivery" value={stats.outForDelivery} meta="Final leg" icon={MapPin} tone="warn" />
            <StatCard label="Delivered today" value={deliveredToday.length} meta="Since midnight" icon={Check} tone="success" />
            <StatCard label="Attempts failed" value={stats.failed} meta="Needs a retry" icon={AlertTriangle} tone={stats.failed ? 'danger' : undefined} />
          </div>

          <div className="dashboard-grid">
            <section className="card">
              <div className="card__header">
                <div>
                  <h2 className="card__title">Today&apos;s queue</h2>
                  <p className="card__subtitle">
                    Assigned to {shortAddress(wallet.address)}. Open an order to
                    decrypt the address and update the status.
                  </p>
                </div>
                <Link to="/queue" className="btn btn--link">
                  Full queue <ArrowRight size={13} aria-hidden="true" />
                </Link>
              </div>
              <div className="card__body">
                {active.length ? (
                  <div className="order-grid">
                    {sortedActive.slice(0, 4).map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        profiles={profiles}
                        actionLabel="Update"
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={Truck}
                    title="Nothing assigned yet"
                    text="When operations assigns an order to your wallet, it appears in your queue automatically."
                    compact
                  />
                )}
              </div>
            </section>

            <div className="stack">
              <section className="card">
                <div className="card__header">
                  <h2 className="card__title">Recent activity</h2>
                </div>
                <div className="card__body">
                  <ActivityList items={notifications.items} limit={7} />
                </div>
              </section>

              <Callout tone="info" title="Your access">
                You only have the order key after the admin assigns the shipment
                to you. If an order is reassigned, it drops out of your queue.
              </Callout>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="stat-grid">
            <StatCard label="Active" value={active.length} meta="Still moving" icon={Package} tone="accent" />
            <StatCard label="In transit" value={stats.inTransit + stats.outForDelivery} meta="On the way" icon={Truck} tone="warn" />
            <StatCard label="Delivered" value={stats.delivered} meta="All time" icon={Check} tone="success" />
            <StatCard label="Needs attention" value={stats.failed} meta="Failed attempts" icon={AlertTriangle} tone={stats.failed ? 'danger' : undefined} />
          </div>

          <div className="dashboard-grid">
            <div className="stack">
              <section className="card">
                <div className="card__header">
                  <div>
                    <h2 className="card__title">Next delivery</h2>
                    <p className="card__subtitle">The shipment closest to your door.</p>
                  </div>
                  {nextOrder ? (
                    <span className="row" style={{ gap: 6, color: 'var(--green)', fontSize: 11.5 }}>
                      <span className="dot dot--live" aria-hidden="true" />
                      Live
                    </span>
                  ) : null}
                </div>
                <NextDelivery order={nextOrder} profiles={profiles} />
              </section>

              <section className="card">
                <div className="card__header">
                  <div>
                    <h2 className="card__title">Active shipments</h2>
                    <p className="card__subtitle">Everything not yet delivered or cancelled.</p>
                  </div>
                  <Link to="/orders" className="btn btn--link">
                    View all <ArrowRight size={13} aria-hidden="true" />
                  </Link>
                </div>
                <div className="card__body">
                  {active.length ? (
                    <div className="order-grid">
                      {active.slice(0, 4).map((order) => (
                        <OrderCard
                          key={order.id}
                          order={order}
                          profiles={profiles}
                          actionLabel="Track"
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={Package}
                      title="No active shipments"
                      text="Create your first order to see the encrypted timeline in action."
                      action={
                        <Link to="/orders/new" className="btn btn--primary">
                          <Plus size={15} aria-hidden="true" />
                          New order
                        </Link>
                      }
                      compact
                    />
                  )}
                </div>
              </section>
            </div>

            <div className="stack">
              <section className="card">
                <div className="card__header">
                  <h2 className="card__title">Recent activity</h2>
                </div>
                <div className="card__body">
                  <ActivityList items={notifications.items} limit={7} />
                </div>
              </section>

              <section className="card card--pad privacy-nudge">
                <span className="gate-icon" style={{ width: 38, height: 38, marginBottom: 12 }}>
                  <ShieldCheck size={18} />
                </span>
                <h2 className="card__title">Only you can read this</h2>
                <p className="card__subtitle" style={{ marginTop: 5 }}>
                  Names, phone numbers and addresses are decrypted in your
                  browser. The chain only stores ciphertext.
                </p>
                <Link
                  to="/privacy"
                  className="btn btn--link"
                  style={{ marginTop: 8, padding: 0 }}
                >
                  How it works <ArrowRight size={13} aria-hidden="true" />
                </Link>
              </section>

              <Callout tone="info" title="One signature per session">
                The vault unlocks for this tab. Lock it from the top bar when you
                step away — decrypted data is cleared from memory.
              </Callout>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
