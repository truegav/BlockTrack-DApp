import { useMemo } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  Gauge,
  Package,
  RefreshCw,
  Truck,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Callout } from '../components/ui/Callout.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { PageSkeleton } from '../components/ui/Skeleton.jsx';
import { StatCard } from '../components/ui/StatCard.jsx';
import { Badge } from '../components/ui/Badges.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { VolumeChart } from '../components/domain/VolumeChart.jsx';
import { StatusMix } from '../components/domain/StatusMix.jsx';
import { useCouriers } from '../hooks/useProfile.js';
import { useOrderStats } from '../hooks/useOrders.js';
import { shortAddress } from '../lib/format.js';

export function ReportsPage() {
  const { ordersState } = useOutletContext();
  const { orders, isLoading, error, refetch, isFetching } = ordersState;
  const stats = useOrderStats(orders);
  const { couriers } = useCouriers();

  const performance = useMemo(() => {
    const rows = couriers.map((courier) => {
      const assigned = orders.filter(
        (order) => order.courier?.toLowerCase() === courier.address.toLowerCase()
      );
      const delivered = assigned.filter((order) => order.status === 'Delivered');
      const failed = assigned.filter((order) => order.status === 'FailedAttempt');
      const active = assigned.filter(
        (order) =>
          order.status !== 'Delivered' && order.status !== 'Cancelled'
      );
      const handled = delivered.length + failed.length;
      const successRate = handled
        ? Math.round((delivered.length / handled) * 100)
        : 0;
      return {
        ...courier,
        assigned: assigned.length,
        delivered: delivered.length,
        failed: failed.length,
        active: active.length,
        successRate,
      };
    });
    return rows.sort((a, b) => b.delivered - a.delivered || b.assigned - a.assigned);
  }, [couriers, orders]);

  const routes = useMemo(() => {
    const counts = new Map();
    for (const order of orders) {
      const from = order.payload?.sender?.city;
      const to = order.payload?.recipient?.city;
      if (!from || !to) continue;
      const key = `${from} → ${to}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const list = [...counts.entries()]
      .map(([route, count]) => ({ route, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
    const max = Math.max(1, ...list.map((item) => item.count));
    return { list, max };
  }, [orders]);

  if (isLoading && !orders.length) return <PageSkeleton title="Loading reports" />;

  return (
    <div className="page">
      <PageHeader
        title="Reports"
        subtitle="Operational aggregates computed in this browser from decrypted chain events. Nothing is sent to a server."
        actions={
          <>
            <Link to="/benchmarks" className="btn btn--secondary">
              <Gauge size={15} aria-hidden="true" />
              Benchmarks
            </Link>
            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={() => refetch()}
              loading={isFetching}
            >
              Refresh
            </Button>
          </>
        }
      />

      {error ? (
        <Callout tone="danger" title="Could not load reports">
          {error.shortMessage || error.message}
        </Callout>
      ) : null}

      <div className="stat-grid">
        <StatCard label="Total orders" value={stats.total} meta="All time" icon={Package} tone="accent" />
        <StatCard label="Delivered" value={stats.delivered} meta={`${stats.delivered7d} in the last 7 days`} icon={Check} tone="success" />
        <StatCard label="Active" value={stats.active} meta={`${stats.unassigned} unassigned`} icon={Truck} tone="warn" />
        <StatCard
          label="Exceptions"
          value={stats.failed + stats.cancelled}
          meta={`${stats.failed} failed · ${stats.cancelled} cancelled`}
          icon={AlertTriangle}
          tone={stats.failed + stats.cancelled ? 'danger' : undefined}
        />
      </div>

      {!orders.length ? (
        <div className="card">
          <EmptyState
            icon={Package}
            title="No order data yet"
            text="Reports become meaningful once orders are registered on the contract."
          />
        </div>
      ) : (
        <>
          <div className="dashboard-grid">
            <section className="card">
              <div className="card__header">
                <div>
                  <h2 className="card__title">Order volume</h2>
                  <p className="card__subtitle">Created per day over the last 14 days.</p>
                </div>
              </div>
              <div className="card__body">
                <VolumeChart orders={orders} />
              </div>
            </section>

            <section className="card">
              <div className="card__header">
                <div>
                  <h2 className="card__title">Status mix</h2>
                  <p className="card__subtitle">Current state of all orders.</p>
                </div>
              </div>
              <div className="card__body">
                <StatusMix orders={orders} />
              </div>
            </section>
          </div>

          <div className="split-2">
            <section className="card">
              <div className="card__header">
                <div>
                  <h2 className="card__title">Courier performance</h2>
                  <p className="card__subtitle">All-time assignments.</p>
                </div>
                <Badge tone="neutral">{couriers.length} couriers</Badge>
              </div>
              {performance.length ? (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th scope="col">Courier</th>
                        <th scope="col">Assigned</th>
                        <th scope="col">Delivered</th>
                        <th scope="col">Failed</th>
                        <th scope="col">Success</th>
                      </tr>
                    </thead>
                    <tbody>
                      {performance.map((courier) => (
                        <tr key={courier.address}>
                          <td>
                            <span className="row" style={{ gap: 8 }}>
                              <Avatar
                                name={courier.name || courier.address}
                                address={courier.address}
                                size="sm"
                              />
                              <span>
                                <span style={{ display: 'block', fontWeight: 500 }}>
                                  {courier.name || shortAddress(courier.address)}
                                </span>
                                <span className="table__muted mono">
                                  {shortAddress(courier.address)}
                                </span>
                              </span>
                            </span>
                          </td>
                          <td className="tabular">{courier.assigned}</td>
                          <td className="tabular">{courier.delivered}</td>
                          <td className="tabular">{courier.failed}</td>
                          <td>
                            <span className="row" style={{ gap: 8 }}>
                              <span className="status-mix__meter" style={{ width: 48 }}>
                                <span
                                  className="status-mix__fill"
                                  style={{
                                    width: `${courier.successRate}%`,
                                    background: 'var(--green)',
                                  }}
                                />
                              </span>
                              <span className="tabular">{courier.successRate}%</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  icon={Truck}
                  title="No courier assignments"
                  text="Assign orders from Dispatch to build performance data."
                  compact
                />
              )}
            </section>

            <section className="card">
              <div className="card__header">
                <div>
                  <h2 className="card__title">Top routes</h2>
                  <p className="card__subtitle">Decrypted city pairs, counted locally.</p>
                </div>
              </div>
              <div className="card__body">
                {routes.list.length ? (
                  <ul className="route-list">
                    {routes.list.map((item) => (
                      <li className="route-row" key={item.route}>
                        <span className="route-row__label">{item.route}</span>
                        <span className="route-row__meter">
                          <span
                            className="route-row__fill"
                            style={{ width: `${(item.count / routes.max) * 100}%` }}
                          />
                        </span>
                        <span className="route-row__count tabular">{item.count}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="field__hint">No route data yet.</p>
                )}
              </div>
            </section>
          </div>
        </>
      )}

      <Callout tone="info" title="Why this is client-side">
        There is no analytics server. The admin browser decrypts accessible orders
        and aggregates them in memory. At production scale this would move to an
        indexer like The Graph, reading only non-sensitive event fields.
      </Callout>
    </div>
  );
}
