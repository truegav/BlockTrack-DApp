import { useMemo } from 'react';
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import {
  ChevronRight,
  Package,
  Plus,
  Truck,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Callout } from '../components/ui/Callout.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { SearchInput } from '../components/ui/SearchInput.jsx';
import { SegmentedControl } from '../components/ui/SegmentedControl.jsx';
import { Pagination } from '../components/ui/Pagination.jsx';
import { Skeleton, TableSkeleton } from '../components/ui/Skeleton.jsx';
import { StatusBadge } from '../components/ui/Badges.jsx';
import { Entity } from '../components/ui/Identity.jsx';
import { CopyButton } from '../components/ui/CopyButton.jsx';
import { OrderCard } from '../components/domain/OrderCard.jsx';
import { useProfiles } from '../hooks/useProfile.js';
import { formatDateTime, formatRelative, shortAddress } from '../lib/format.js';
import { isFinalStatus } from '../lib/status.js';

const PAGE_SIZE = 8;
const ZERO = '0x0000000000000000000000000000000000000000';

function matchesScope(order, scope) {
  if (scope === 'active') return !isFinalStatus(order.status);
  if (scope === 'delivered') return order.status === 'Delivered';
  if (scope === 'cancelled') return order.status === 'Cancelled';
  return true;
}

export function OrdersPage() {
  const { session, ordersState } = useOutletContext();
  const { role, wallet } = session;
  const { orders, isLoading, error, isFetching } = ordersState;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const query = params.get('q') || '';
  const scope = params.get('scope') || 'all';
  const page = Math.max(1, Number(params.get('page') || 1));

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

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return orders
      .filter((order) => matchesScope(order, scope))
      .filter((order) => {
        if (!needle) return true;
        const owner = profiles[order.owner?.toLowerCase()];
        const courier = profiles[order.courier?.toLowerCase()];
        return [
          order.id,
          order.payload?.recipient?.name,
          order.payload?.recipient?.city,
          order.payload?.sender?.city,
          order.payload?.parcel?.description,
          owner?.displayName,
          courier?.displayName,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle));
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [orders, profiles, query, scope]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (!value || value === 'all') next.delete(key);
    else next.set(key, value);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const scopeOptions = [
    { value: 'all', label: 'All', count: orders.length },
    {
      value: 'active',
      label: 'Active',
      count: orders.filter((order) => !isFinalStatus(order.status)).length,
    },
    {
      value: 'delivered',
      label: 'Delivered',
      count: orders.filter((order) => order.status === 'Delivered').length,
    },
    {
      value: 'cancelled',
      label: 'Cancelled',
      count: orders.filter((order) => order.status === 'Cancelled').length,
    },
  ];

  const title = role === 'admin' ? 'All orders' : 'My orders';
  const isAdmin = role === 'admin';

  if (isLoading && !orders.length) {
    return (
      <div className="page">
        <PageHeader
          title={title}
          subtitle="Loading encrypted shipments from the chain…"
        />
        <div className="card">
          <div className="card__header">
            <Skeleton width={180} height={14} />
            <Skeleton width={220} height={34} />
          </div>
          <TableSkeleton rows={6} columns={isAdmin ? 6 : 5} />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title={title}
        subtitle={
          role === 'admin'
            ? 'Every order on the contract. You hold a wrapped key for each one.'
            : 'Only the orders placed by this wallet. The payload is decrypted locally.'
        }
        actions={
          <Link to="/orders/new" className="btn btn--primary">
            <Plus size={15} aria-hidden="true" />
            {isAdmin ? 'Register order' : 'New order'}
          </Link>
        }
      />

      {error ? (
        <Callout tone="danger" title="Could not load orders">
          {error.shortMessage || error.message}
        </Callout>
      ) : null}

      <div className="toolbar">
        <div className="toolbar__left">
          <SegmentedControl
            ariaLabel="Filter orders"
            options={scopeOptions}
            value={scope}
            onChange={(value) => setParam('scope', value)}
          />
        </div>
        <div className="toolbar__right">
          <SearchInput
            value={query}
            onChange={(event) => setParam('q', event.target.value)}
            placeholder="Search ID, recipient, city…"
            label="Search orders"
          />
          {isFetching ? (
            <span className="field__hint" aria-live="polite">
              Refreshing…
            </span>
          ) : null}
        </div>
      </div>

      <div className="card">
        {visible.length ? (
          <>
            <div className="desktop-only">
              <div className="table-wrap">
                <table className="table">
                  <caption className="sr-only">
                    {isAdmin ? 'All orders' : 'Your orders'}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Tracking ID</th>
                      {isAdmin ? <th scope="col">Customer</th> : null}
                      <th scope="col">Shipment</th>
                      <th scope="col">Status</th>
                      <th scope="col">Courier</th>
                      <th scope="col">Updated</th>
                      <th scope="col">
                        <span className="sr-only">Open</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((order) => {
                      const ownerProfile = profiles[order.owner?.toLowerCase()];
                      const courierProfile = profiles[order.courier?.toLowerCase()];
                      const assigned = order.courier && order.courier !== ZERO;
                      return (
                        <tr
                          key={order.id}
                          data-clickable="true"
                          onClick={() => navigate(`/orders/${order.id}`)}
                        >
                          <td>
                            <span className="row" style={{ gap: 4 }}>
                              <Link
                                to={`/orders/${order.id}`}
                                className="table__id"
                                onClick={(event) => event.stopPropagation()}
                              >
                                {order.id}
                              </Link>
                              <CopyButton value={order.id} label="Copy tracking ID" />
                            </span>
                          </td>
                          {isAdmin ? (
                            <td>
                              <Entity
                                address={order.owner}
                                name={ownerProfile?.displayName || shortAddress(order.owner)}
                                size="sm"
                              />
                            </td>
                          ) : null}
                          <td>
                            <div style={{ fontWeight: 500 }}>
                              {order.payload?.recipient?.name || 'Encrypted'}
                            </div>
                            <div className="table__muted">
                              {order.payload?.sender?.city} →{' '}
                              {order.payload?.recipient?.city}
                            </div>
                          </td>
                          <td>
                            <StatusBadge status={order.status} />
                          </td>
                          <td>
                            {assigned ? (
                              <Entity
                                address={order.courier}
                                name={courierProfile?.displayName || shortAddress(order.courier)}
                                size="sm"
                              />
                            ) : (
                              <span className="tag">Unassigned</span>
                            )}
                          </td>
                          <td title={formatDateTime(order.updatedAt)}>
                            <span className="table__muted">
                              {formatRelative(order.updatedAt)}
                            </span>
                          </td>
                          <td className="table__actions">
                            <ChevronRight
                              size={15}
                              aria-hidden="true"
                              style={{ color: 'var(--ink-3)' }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mobile-only" style={{ padding: 12 }}>
              <div className="order-grid">
                {visible.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    profiles={profiles}
                    showOwner={isAdmin}
                    actionLabel="Open"
                  />
                ))}
              </div>
            </div>

            <Pagination
              page={currentPage}
              pageCount={pageCount}
              total={filtered.length}
              pageSize={PAGE_SIZE}
              onChange={(nextPage) => {
                const next = new URLSearchParams(params);
                if (nextPage <= 1) next.delete('page');
                else next.set('page', String(nextPage));
                setParams(next, { replace: true });
              }}
            />
          </>
        ) : (
          <EmptyState
            icon={query || scope !== 'all' ? Package : isAdmin ? Truck : Package}
            title={
              query || scope !== 'all'
                ? 'No matching orders'
                : isAdmin
                  ? 'No orders on the contract'
                  : 'No orders yet'
            }
            text={
              query || scope !== 'all'
                ? 'Try a different search or filter. All filtering happens locally after decryption.'
                : isAdmin
                  ? 'Register an order on behalf of a customer, or wait for the first one to arrive.'
                  : 'Create your first shipment. Its details are encrypted before they reach the chain.'
            }
            action={
              query || scope !== 'all' ? (
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => setParams({}, { replace: true })}
                >
                  Clear filters
                </button>
              ) : (
                <Link to="/orders/new" className="btn btn--primary">
                  <Plus size={15} aria-hidden="true" />
                  {isAdmin ? 'Register order' : 'New order'}
                </Link>
              )
            }
          />
        )}
      </div>
    </div>
  );
}
