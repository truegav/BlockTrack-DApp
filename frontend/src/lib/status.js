import {
  AlertTriangle,
  Check,
  FileText,
  MapPin,
  Package,
  Truck,
  X,
} from 'lucide-react';

export const ORDER_STATUSES = [
  {
    key: 'Created',
    index: 0,
    label: 'Registered',
    short: 'Registered',
    tone: 'created',
    icon: FileText,
    description: 'Order received and waiting for pickup.',
  },
  {
    key: 'PickedUp',
    index: 1,
    label: 'Picked up',
    short: 'Picked up',
    tone: 'picked-up',
    icon: Package,
    description: 'Collected from the sender.',
  },
  {
    key: 'InTransit',
    index: 2,
    label: 'In transit',
    short: 'In transit',
    tone: 'in-transit',
    icon: Truck,
    description: 'Moving through the network.',
  },
  {
    key: 'OutForDelivery',
    index: 3,
    label: 'Out for delivery',
    short: 'Out for delivery',
    tone: 'out-for-delivery',
    icon: MapPin,
    description: 'With the courier for final delivery.',
  },
  {
    key: 'Delivered',
    index: 4,
    label: 'Delivered',
    short: 'Delivered',
    tone: 'delivered',
    icon: Check,
    description: 'Delivered to the recipient.',
  },
  {
    key: 'FailedAttempt',
    index: 5,
    label: 'Attempt failed',
    short: 'Attempt failed',
    tone: 'failed',
    icon: AlertTriangle,
    description: 'A delivery attempt could not be completed.',
  },
  {
    key: 'Cancelled',
    index: 6,
    label: 'Cancelled',
    short: 'Cancelled',
    tone: 'cancelled',
    icon: X,
    description: 'The order was cancelled.',
  },
];

export const STATUS_BY_INDEX = Object.fromEntries(
  ORDER_STATUSES.map((status) => [status.index, status])
);

export const STATUS_BY_KEY = Object.fromEntries(
  ORDER_STATUSES.map((status) => [status.key, status])
);

export const HAPPY_PATH = [
  'Created',
  'PickedUp',
  'InTransit',
  'OutForDelivery',
  'Delivered',
];

export const ALLOWED_NEXT = {
  Created: ['PickedUp'],
  PickedUp: ['InTransit'],
  InTransit: ['OutForDelivery'],
  OutForDelivery: ['Delivered', 'FailedAttempt'],
  FailedAttempt: ['OutForDelivery'],
  Delivered: [],
  Cancelled: [],
};

export function statusByIndex(index) {
  return STATUS_BY_INDEX[Number(index)] ?? STATUS_BY_INDEX[0];
}

export function statusByKey(key) {
  return STATUS_BY_KEY[key] ?? STATUS_BY_INDEX[0];
}

export function statusIndex(key) {
  return statusByKey(key).index;
}

export function statusLabel(value) {
  if (value === null || value === undefined) return 'Unknown';
  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    return statusByIndex(value).label;
  }
  return statusByKey(value).label;
}

export function statusMeta(value) {
  if (value === null || value === undefined) return STATUS_BY_INDEX[0];
  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    return statusByIndex(value);
  }
  return statusByKey(value);
}

export function nextStatuses(currentKey) {
  return (ALLOWED_NEXT[currentKey] ?? []).map((key) => STATUS_BY_KEY[key]);
}

export function isFinalStatus(value) {
  const key = statusMeta(value).key;
  return key === 'Delivered' || key === 'Cancelled';
}

export function isActiveStatus(value) {
  return !isFinalStatus(value);
}

export function canCustomerCancel(statusKey) {
  return statusKey === 'Created';
}

export function canCancelOrder({ status, address, owner, role }) {
  if (!address || isFinalStatus(status)) return false;
  if (role === 'admin') return true;
  return (
    role === 'customer' &&
    owner?.toLowerCase() === address.toLowerCase() &&
    canCustomerCancel(status)
  );
}

export function canUpdateOrder({ status, address, courier, role }) {
  if (!address || isFinalStatus(status)) return false;
  if (role === 'admin') return true;
  return (
    role === 'courier' &&
    courier?.toLowerCase() === address.toLowerCase() &&
    (ALLOWED_NEXT[status] ?? []).length > 0
  );
}

export function progressIndex(value) {
  const key = statusMeta(value).key;
  if (key === 'FailedAttempt') return HAPPY_PATH.indexOf('OutForDelivery');
  if (key === 'Cancelled') return -1;
  return HAPPY_PATH.indexOf(key);
}

export function progressSteps(currentKey) {
  const current = statusMeta(currentKey);
  const failed = current.key === 'FailedAttempt';
  const cancelled = current.key === 'Cancelled';
  const currentIndex = progressIndex(current.key);
  return HAPPY_PATH.map((key, index) => {
    const meta = STATUS_BY_KEY[key];
    let state = 'upcoming';
    if (!cancelled && index < currentIndex) state = 'done';
    if (!cancelled && index === currentIndex) {
      state = current.key === 'Delivered' ? 'done' : 'current';
    }
    if (failed && index === currentIndex) state = 'failed';
    if (cancelled) state = 'cancelled';
    return { ...meta, state };
  });
}

export function stepStateLabel(state) {
  if (state === 'done') return 'Completed';
  if (state === 'current') return 'Current';
  if (state === 'failed') return 'Failed';
  if (state === 'cancelled') return 'Cancelled';
  return 'Pending';
}

export function actionLabelFor(statusKey) {
  const meta = statusByKey(statusKey);
  return `Mark ${meta.label.toLowerCase()}`;
}
