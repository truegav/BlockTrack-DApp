import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { RefreshCw, Truck } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Callout } from '../components/ui/Callout.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { SearchInput } from '../components/ui/SearchInput.jsx';
import { SegmentedControl } from '../components/ui/SegmentedControl.jsx';
import { StatCard } from '../components/ui/StatCard.jsx';
import { PageSkeleton } from '../components/ui/Skeleton.jsx';
import { OrderCard } from '../components/domain/OrderCard.jsx';

function startOfToday() {
  const now = new Date();
  return Math.floor(
    new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000
  );
}

export function QueuePage() {
  const { session, ordersState } = useOutletContext();
  const { orders, isLoading, error, refetch, isFetching } = ordersState;
  const [filter, setFilter] = useState('active');
  const [search, setSearch] = useState('');

  const active = orders.filter(
    (order) => order.status !== 'Delivered' && order.status !== 'Cancelled'
  );
  const outForDelivery = orders.filter((order) => order.status === 'OutForDelivery');
  const completed = orders.filter(
    (order) => order.status === 'Delivered' || order.status === 'Cancelled'
  );
  const failed = orders.filter((order) => order.status === 'FailedAttempt');
  const today = startOfToday();
  const deliveredToday = orders.filter(
    (order) => order.status === 'Delivered' && order.updatedAt >= today
  );

  const profiles = useMemo(
    () => ({
      [session.wallet.address.toLowerCase()]: {
        displayName: session.profile?.displayName || session.wallet.address,
        address: session.wallet.address,
      },
    }),
    [session.profile?.displayName, session.wallet.address]
  );

  const source =
    filter === 'active' ? active : filter === 'out' ? outForDelivery : completed;

  const filtered = source.filter((order) => {
    if (!search.trim()) return true;
    const needle = search.trim().toLowerCase();
    return (
      order.id.toLowerCase().includes(needle) ||
      order.payload?.recipient?.name?.toLowerCase().includes(needle) ||
      order.payload?.recipient?.city?.toLowerCase().includes(needle)
    );
  });

  const options = [
    { value: 'active', label: 'Needs action', count: active.length },
    { value: 'out', label: 'Out for delivery', count: outForDelivery.length },
    { value: 'done', label: 'Completed', count: completed.length },
  ];

  if (isLoading && !orders.length) return <PageSkeleton title="Loading delivery queue" />;

  return (
    <div className="page">
      <PageHeader
        title="Delivery queue"
        subtitle="Orders assigned to you. You can only see shipments the admin has assigned to your wallet."
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
        <Callout tone="danger" title="Could not load your queue">
          {error.shortMessage || error.message}
        </Callout>
      ) : null}

      <div className="stat-grid">
        <StatCard
          label="Assigned to you"
          value={active.length}
          meta="Active shipments"
          icon={Truck}
          tone="accent"
        />
        <StatCard
          label="Out for delivery"
          value={outForDelivery.length}
          meta="Final leg today"
          icon={Truck}
          tone="warn"
        />
        <StatCard
          label="Delivered today"
          value={deliveredToday.length}
          meta="Since midnight"
          icon={Truck}
          tone="success"
        />
        <StatCard
          label="Attempts failed"
          value={failed.length}
          meta="Needs a retry"
          icon={Truck}
          tone={failed.length ? 'danger' : undefined}
        />
      </div>

      <div className="toolbar">
        <div className="toolbar__left">
          <SegmentedControl
            ariaLabel="Filter queue"
            options={options}
            value={filter}
            onChange={setFilter}
          />
        </div>
        <div className="toolbar__right">
          <SearchInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search ID, name, or city…"
            label="Search queue"
          />
        </div>
      </div>

      {filter === 'active' && active.length ? (
        <Callout tone="info" title="Encrypted at rest">
          Open a shipment to read the recipient details with your vault key, then
          write the next status update. Notes and locations are encrypted before
          they are sent.
        </Callout>
      ) : null}

      {filtered.length ? (
        <div className="order-grid">
          {filtered.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              profiles={profiles}
              actionLabel={order.status === 'Delivered' ? 'View' : 'Update'}
            />
          ))}
        </div>
      ) : (
        <div className="card">
          <EmptyState
            icon={Truck}
            title={
              search
                ? 'No matching shipments'
                : filter === 'active'
                  ? 'No deliveries assigned'
                  : filter === 'out'
                    ? 'Nothing out for delivery'
                    : 'Nothing completed yet'
            }
            text={
              search
                ? 'Try a different tracking ID, recipient name, or city.'
                : 'When an admin assigns an order to your wallet, it appears here automatically.'
            }
          />
        </div>
      )}
    </div>
  );
}
