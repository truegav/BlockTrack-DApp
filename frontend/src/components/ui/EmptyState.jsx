import { Package } from 'lucide-react';

export function EmptyState({
  icon: Icon = Package,
  title,
  text,
  action,
  secondary,
  compact = false,
}) {
  return (
    <div className={`empty ${compact ? 'empty--sm' : ''}`.trim()}>
      <div className="empty__art" aria-hidden="true">
        <Icon />
      </div>
      {title ? <h2 className="empty__title">{title}</h2> : null}
      {text ? <p className="empty__text">{text}</p> : null}
      {action || secondary ? (
        <div className="empty__actions">
          {action}
          {secondary}
        </div>
      ) : null}
    </div>
  );
}
