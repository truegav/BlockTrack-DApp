import { avatarColor, initials } from '../../lib/format.js';

export function Avatar({
  name = '',
  address = '',
  size,
  className = '',
  title,
}) {
  const classes = ['avatar', size ? `avatar--${size}` : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <span
      className={classes}
      style={{ background: avatarColor(address, name) }}
      title={title || name || address}
      aria-hidden="true"
    >
      {initials(name || address)}
    </span>
  );
}
