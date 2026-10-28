import { Link } from 'react-router-dom';

export function LogoMark({ size = 30, className = '' }) {
  return (
    <span
      className={`brand-mark ${className}`.trim()}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4.5 7.4 12 3.6l7.5 3.8v9.2L12 20.4l-7.5-3.8V7.4Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="m4.5 7.4 7.5 3.9 7.5-3.9M12 11.3v9.1"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
          opacity="0.55"
        />
        <circle cx="12" cy="11.3" r="1.45" fill="currentColor" />
      </svg>
    </span>
  );
}

export function Logo({ to = '/', tone = 'default', size = 30, className }) {
  const classes =
    className || (tone === 'light' ? 'auth-visual__brand' : 'sidebar__brand');
  return (
    <Link to={to} className={classes} aria-label="BlockTrack home">
      <LogoMark size={size} />
      <span className="brand-word" translate="no">
        Block<span>Track</span>
      </span>
    </Link>
  );
}
