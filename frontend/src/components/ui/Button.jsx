import { Link } from 'react-router-dom';

export function Button({
  children,
  variant = 'secondary',
  size,
  loading = false,
  disabled = false,
  icon: Icon,
  iconRight: IconRight,
  block = false,
  className = '',
  type = 'button',
  ...props
}) {
  const classes = [
    'btn',
    `btn--${variant}`,
    size ? `btn--${size}` : '',
    block ? 'btn--block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <span className="btn__spinner" aria-hidden="true" />
      ) : Icon ? (
        <Icon size={15} aria-hidden="true" />
      ) : null}
      {children ? <span>{children}</span> : null}
      {IconRight && !loading ? <IconRight size={15} aria-hidden="true" /> : null}
    </button>
  );
}

export function IconButton({
  label,
  icon: Icon,
  variant = 'ghost',
  size = 'icon',
  className = '',
  ...props
}) {
  return (
    <button
      type="button"
      className={`btn btn--${variant} btn--${size} ${className}`.trim()}
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon size={16} aria-hidden="true" />
    </button>
  );
}

export function LinkButton({
  to,
  children,
  variant = 'secondary',
  size,
  icon: Icon,
  className = '',
  ...props
}) {
  return (
    <Link
      to={to}
      className={[
        'btn',
        `btn--${variant}`,
        size ? `btn--${size}` : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {Icon ? <Icon size={15} aria-hidden="true" /> : null}
      <span>{children}</span>
    </Link>
  );
}
