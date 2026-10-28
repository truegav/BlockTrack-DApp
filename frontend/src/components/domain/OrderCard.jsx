import { Link } from 'react-router-dom';
import { ArrowUpRight, MapPin, Package, Truck } from 'lucide-react';
import { formatRelative, shortAddress } from '../../lib/format.js';
import { StatusBadge } from '../ui/Badges.jsx';
import { Avatar } from '../ui/Avatar.jsx';

const ZERO = '0x0000000000000000000000000000000000000000';

export function OrderCard({
  order,
  profiles = {},
  showOwner = false,
  actionLabel = 'Open',
}) {
  if (!order) return null;
  const payload = order.payload;
  const recipient = payload?.recipient;
  const sender = payload?.sender;
  const destination = recipient
    ? `${recipient.name} · ${recipient.city}`
    : 'Encrypted shipment';
  const route =
    sender && recipient
      ? `${sender.city} → ${recipient.city}`
      : null;
  const assigned = order.courier && order.courier !== ZERO;
  const ownerProfile = profiles[order.owner?.toLowerCase()];
  const courierProfile = profiles[order.courier?.toLowerCase()];
  const personName = showOwner
    ? ownerProfile?.displayName || shortAddress(order.owner)
    : assigned
      ? courierProfile?.displayName || shortAddress(order.courier)
      : 'Unassigned';

  return (
    <Link to={`/orders/${order.id}`} className="order-card">
      <div className="order-card__head">
        <span className="table__id" translate="no">
          {order.id}
        </span>
        <StatusBadge status={order.status} />
      </div>

      <div className="order-card__main">
        <span className="order-card__icon" aria-hidden="true">
          <Package size={15} />
        </span>
        <span className="order-card__body">
          <span className="order-card__title">{destination}</span>
          <span className="order-card__sub">
            {payload?.parcel?.description || 'Encrypted parcel details'}
          </span>
        </span>
      </div>

      <div className="order-card__meta">
        {route ? (
          <span>
            <MapPin size={12} aria-hidden="true" />
            {route}
          </span>
        ) : (
          <span>
            <MapPin size={12} aria-hidden="true" />
            Destination encrypted
          </span>
        )}
        <span>{formatRelative(order.updatedAt)}</span>
      </div>

      <div className="order-card__foot">
        <span className="order-card__person">
          {showOwner ? (
            <Avatar name={personName} address={order.owner} size="sm" />
          ) : assigned ? (
            <Avatar name={personName} address={order.courier} size="sm" />
          ) : (
            <span className="order-card__unassigned" aria-hidden="true">
              <Truck size={13} />
            </span>
          )}
          <span>{personName}</span>
        </span>
        <span className="order-card__action">
          {actionLabel} <ArrowUpRight size={13} aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}
