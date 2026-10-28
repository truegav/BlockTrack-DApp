export function SegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
  size,
  className = '',
}) {
  return (
    <div
      className={`segmented ${size === 'sm' ? 'segmented--sm' : ''} ${className}`.trim()}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            className="segmented__item"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {Icon ? <Icon size={13} aria-hidden="true" /> : null}
            <span>{option.label}</span>
            {typeof option.count === 'number' ? (
              <span className="segmented__count">{option.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
