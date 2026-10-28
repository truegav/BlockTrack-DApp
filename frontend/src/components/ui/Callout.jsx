import { AlertTriangle, Check, Info, X } from 'lucide-react';

const ICONS = {
  info: Info,
  success: Check,
  warning: AlertTriangle,
  danger: X,
  default: Info,
};

export function Callout({
  tone = 'default',
  title,
  children,
  action,
  className = '',
  role,
}) {
  const Icon = ICONS[tone] ?? Info;
  return (
    <div
      className={`callout ${tone !== 'default' ? `callout--${tone}` : ''} ${className}`.trim()}
      role={role}
    >
      <Icon size={16} aria-hidden="true" />
      <div style={{ minWidth: 0, flex: 1 }}>
        {title ? <div className="callout__title">{title}</div> : null}
        {children ? <div className="callout__body">{children}</div> : null}
      </div>
      {action ? <div style={{ flex: 'none' }}>{action}</div> : null}
    </div>
  );
}
