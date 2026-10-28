import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext.jsx';

export function ThemeToggle({ className = '' }) {
  const { resolved, toggleTheme } = useTheme();
  const dark = resolved === 'dark';
  const Icon = dark ? Sun : Moon;
  const label = dark ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <button
      type="button"
      className={`icon-btn ${className}`.trim()}
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      aria-pressed={dark}
    >
      <Icon size={17} aria-hidden="true" />
    </button>
  );
}
