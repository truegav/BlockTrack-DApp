import { statusMeta } from '../../lib/status.js';

export function Badge({ children, tone = 'neutral', icon: Icon, className = '' }) {
  return (
    <span className={`badge badge--${tone} ${className}`.trim()}>
      {Icon ? <Icon size={12} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export function StatusBadge({ status, className = '' }) {
  const meta = statusMeta(status);
  const Icon = meta.icon;
  return (
    <span
      className={`status-badge status-badge--${meta.tone} ${className}`.trim()}
      title={meta.description}
    >
      <Icon aria-hidden="true" />
      <span>{meta.label}</span>
    </span>
  );
}

const ROLE_META = {
  admin: { label: 'Admin', tone: 'blue' },
  courier: { label: 'Courier', tone: 'violet' },
  customer: { label: 'Customer', tone: 'neutral' },
};

export function RoleBadge({ role = 'customer', className = '' }) {
  const meta = ROLE_META[role] ?? ROLE_META.customer;
  return (
    <span className={`badge badge--${meta.tone} ${className}`.trim()}>
      {meta.label}
    </span>
  );
}

export function ChainBadge() {
  return (
    <span className="badge badge--green">
      <span className="dot" aria-hidden="true" />
      On-chain
    </span>
  );
}
