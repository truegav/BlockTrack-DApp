export function Spinner({ size, label, className = '' }) {
  return (
    <span
      className={`spinner ${size === 'lg' ? 'spinner--lg' : ''} ${className}`.trim()}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
    />
  );
}
