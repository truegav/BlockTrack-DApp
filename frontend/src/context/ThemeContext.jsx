import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { readString, writeString } from '../lib/storage.js';

const ThemeContext = createContext(null);
const MEDIA = '(prefers-color-scheme: dark)';

function resolveTheme(theme) {
  if (theme === 'light' || theme === 'dark') return theme;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia(MEDIA).matches ? 'dark' : 'light';
  }
  return 'light';
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => readString('theme', 'system'));
  const [resolved, setResolved] = useState(() => resolveTheme(theme));

  const setTheme = useCallback((next) => {
    setThemeState(next);
    writeString('theme', next);
  }, []);

  useEffect(() => {
    const media = window.matchMedia(MEDIA);
    const apply = () => {
      const next = resolveTheme(theme);
      setResolved(next);
      document.documentElement.dataset.theme = next;
      document.documentElement.style.colorScheme = next;
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', next === 'dark' ? '#0a1219' : '#f4f6f8');
    };
    apply();
    const onChange = () => {
      if (theme === 'system') apply();
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(resolved === 'dark' ? 'light' : 'dark');
  }, [resolved, setTheme]);

  const value = useMemo(
    () => ({ theme, resolved, setTheme, toggleTheme }),
    [theme, resolved, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
