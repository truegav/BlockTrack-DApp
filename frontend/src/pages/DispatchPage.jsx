import { useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  ArrowRight,
  KeyRound,
  Package,
  RefreshCw,
  Truck,
  Users,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Callout } from '../components/ui/Callout.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { PageSkeleton } from '../components/ui/Skeleton.jsx';
import { StatCard } from '../components/ui/StatCard.jsx';
import { StatusBadge } from '../components/ui/Badges.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { AssignCourierDialog } from '../components/domain/AssignCourierDialog.jsx';
import { useCouriers } from '../hooks/useProfile.js';
import { formatRelative, shortAddress } from '../lib/format.js';

const ZERO = '0x0000000000000000000000000000000000000000';

export function DispatchPage() {
  const { session, ordersState } = useOutletContext();
  const { orders, isLoading, error, refetch, isFetching } = ordersState;
  const { couriers } = useCouriers();
  const [selectedOrder, setSelectedOrder] = useState(null);

  const unassigned = useMemo(
    () =>
      orders
        .filter(
          (order) =>
            order.status !== 'Delivered' &&
            order.status !== 'Cancelled' &&
            (!order.courier || order.courier === ZERO)
        )
        .sort((a, b) => b.createdAt - a.createdAt),
    [orders]
  );

  const active = orders.filter(
    (order) => order.status !== 'Delivered' && order.status !== 'Cancelled'
  );
  const readyCouriers = couriers.filter(
    (courier) => courier.exists && courier.publicKey && courier.publicKey !== '0x'
  );

  const workload = (address) =>
    active.filter(
      (order) => order.courier?.toLowerCase() === address.toLowerCase()
    );

  if (isLoading && !orders.length) return <PageSkeleton title="Loading dispatch" />;

  return (
    <div className="page">
      <PageHeader
        title="Dispatch"
        subtitle="Assign unassigned shipments. The selected courier receives the order key wrapped to their vault public key."
        actions={
          <Button
            variant="secondary"
            icon={RefreshCw}
            onClick={() => refetch()}
            loading={isFetching}
          >
            Refresh
          </Button>
        }
      />

      {error ? (
        <Callout tone="danger" title="Could not load dispatch data">
          {error.shortMessage || error.message}
        </Callout>
      ) : null}

      <div className="stat-grid">
        <StatCard
          label="Unassigned"
          value={unassigned.length}
          meta="Waiting for a courier"
          icon={Package}
          tone={unassigned.length ? 'warn' : 'success'}
        />
        <StatCard
          label="Active"
          value={active.length}
          meta="Across all couriers"
          icon={Truck}
          tone="accent"
        />
        <StatCard
          label="Couriers ready"
          value={`${readyCouriers.length}/${couriers.length}`}
          meta="Vault keys registered"
          icon={KeyRound}
          tone="success"
        />
        <StatCard
          label="Team"
          value={couriers.length}
          meta="With the courier role"
          icon={Users}
          tone="neutral"
        />
      </div>

      <Callout tone="info" title="Key hand-off">
        Assigning is a local unwrap + rewrap: your admin vault opens the order
        key, ECIES-encrypts it for the courier&apos;s public key, and writes only
        the new envelope on-chain.
      </Callout>

      <div className="dashboard-grid">
        <section className="card">
          <div className="card__header">
            <div>
              <h2 className="card__title">Needs dispatch</h2>
              <p className="card__subtitle">
                {unassigned.length
                  ? `${unassigned.length} active order${
                      unassigned.length === 1 ? '' : 's'
                    } without a courier.`
                  : 'Everything active is assigned.'}
              </p>
            </div>
            <Link to="/orders" className="btn btn--link">
              All orders <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>

          {unassigned.length ? (
            <ul className="dispatch-rows">
              {unassigned.map((order) => (
                <li className="dispatch-row" key={order.id}>
                  <span className="activity-item__icon activity-item__icon--created">
                    <Package size={14} aria-hidden="true" />
                  </span>
                  <span className="dispatch-row__body">
                    <span className="dispatch-row__title">
                      <Link to={`/orders/${order.id}`} className="mono">
                        {order.id}
                      </Link>
                      <StatusBadge status={order.status} />
                    </span>
                    <span className="dispatch-row__sub">
                      {order.payload?.recipient?.name || 'Encrypted recipient'} ·{' '}
                      {order.payload?.sender?.city} →{' '}
                      {order.payload?.recipient?.city} ·{' '}
                      {formatRelative(order.createdAt)}
                    </span>
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Truck}
                    onClick={() => setSelectedOrder(order)}
                  >
                    Assign
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={Truck}
              title="Everything is dispatched"
              text="When a new order is registered without a courier, it will appear here."
              compact
            />
          )}
        </section>

        <section className="card">
          <div className="card__header">
            <div>
              <h2 className="card__title">Courier workload</h2>
              <p className="card__subtitle">Active assignments per courier.</p>
            </div>
            <Link to="/team" className="btn btn--link">
              Team <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>
          <div className="card__body">
            {couriers.length ? (
              <ul className="courier-workload">
                {couriers.map((courier) => {
                  const assigned = workload(courier.address);
                  const out = assigned.filter(
                    (order) => order.status === 'OutForDelivery'
                  ).length;
                  const ready =
                    courier.exists &&
                    courier.publicKey &&
                    courier.publicKey !== '0x';
                  return (
                    <li className="courier-workload__item" key={courier.address}>
                      <Avatar
                        name={courier.name || courier.address}
                        address={courier.address}
                        size="sm"
                      />
                      <div className="courier-workload__body">
                        <div className="courier-workload__name">
                          {courier.name || shortAddress(courier.address)}
                        </div>
                        <div className="courier-workload__meta">
                          {assigned.length} active · {out} out for delivery
                        </div>
                      </div>
                      <span
                        className={`badge ${ready ? 'badge--green' : 'badge--amber'}`}
                      >
                        {ready ? 'Key ready' : 'No vault key'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                icon={Users}
                title="No couriers"
                text="Add a courier from the Team page, then ask them to unlock their vault once."
                compact
              />
            )}
          </div>
        </section>
      </div>

      {selectedOrder ? (
        <AssignCourierDialog
          open
          onClose={() => setSelectedOrder(null)}
          order={selectedOrder}
          couriers={couriers}
          orders={orders}
        />
      ) : null}
    </div>
  );
}
