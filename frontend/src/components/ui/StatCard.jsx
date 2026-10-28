export function StatCard({
  label,
  value,
  meta,
  icon: Icon,
  tone,
  className = '',
}) {
  return (
    <div className={`stat ${tone ? `stat--${tone}` : ''} ${className}`.trim()}>
      <div className="stat__head">
        <span className="stat__label">{label}</span>
        {Icon ? (
          <span className="stat__icon" aria-hidden="true">
            <Icon />
          </span>
        ) : null}
      </div>
      <div className="stat__value tabular">{value}</div>
      {meta ? <div className="stat__meta">{meta}</div> : null}
    </div>
  );
}
