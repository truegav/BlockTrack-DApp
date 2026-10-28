import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AlertTriangle, Check, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = {
  success: Check,
  error: AlertTriangle,
  warning: AlertTriangle,
  info: Info,
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);
  const timersRef = useRef(new Map());

  const dismissToast = useCallback((id) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    ({ title, message, tone = 'info', duration }) => {
      idRef.current += 1;
      const id = idRef.current;
      const toast = { id, title, message, tone };
      setToasts((current) => [...current.slice(-2), toast]);

      const timeout = duration ?? (tone === 'error' ? 7000 : 4800);
      const timer = setTimeout(() => dismissToast(id), timeout);
      timersRef.current.set(id, timer);
      return id;
    },
    [dismissToast]
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  const toast = useMemo(
    () => ({
      success: (title, message, options) =>
        pushToast({ title, message, tone: 'success', ...options }),
      error: (title, message, options) =>
        pushToast({ title, message, tone: 'error', ...options }),
      warning: (title, message, options) =>
        pushToast({ title, message, tone: 'warning', ...options }),
      info: (title, message, options) =>
        pushToast({ title, message, tone: 'info', ...options }),
    }),
    [pushToast]
  );

  const value = useMemo(
    () => ({ toasts, pushToast, dismissToast, toast }),
    [toasts, pushToast, dismissToast, toast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="toast-stack"
        role="status"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((item) => {
          const Icon = ICONS[item.tone] ?? Info;
          return (
            <div key={item.id} className={`toast toast--${item.tone}`}>
              <span className="toast__icon" aria-hidden="true">
                <Icon size={16} />
              </span>
              <div className="toast__body">
                {item.title && <div className="toast__title">{item.title}</div>}
                {item.message && (
                  <div className="toast__message">{item.message}</div>
                )}
              </div>
              <button
                type="button"
                className="toast__close"
                aria-label="Dismiss notification"
                onClick={() => dismissToast(item.id)}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context.toast;
}
