import { useEffect, useRef, useState } from 'react';

export function Dropdown({
  trigger,
  children,
  panelClassName = 'menu',
  panelLabel,
  panelRole,
  align = 'right',
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!anchorRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className={`anchor ${className}`.trim()} ref={anchorRef}>
      {trigger({ open, toggle: () => setOpen((current) => !current) })}
      {open ? (
        <div
          className={`${panelClassName} ${align === 'left' ? 'menu--left' : ''}`.trim()}
          aria-label={panelLabel}
          role={panelRole}
        >
          {typeof children === 'function'
            ? children({ close: () => setOpen(false) })
            : children}
        </div>
      ) : null}
    </div>
  );
}
