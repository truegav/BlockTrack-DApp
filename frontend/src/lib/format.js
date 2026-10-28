const relativeFormatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: 'auto',
});

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});

const weekdayFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('en-IN');

export function toDate(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    // Chain seconds vs JavaScript milliseconds.
    return new Date(value < 10_000_000_000 ? value * 1000 : value);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(value) {
  const date = toDate(value);
  return date ? dateFormatter.format(date) : '—';
}

export function formatDateTime(value) {
  const date = toDate(value);
  return date ? dateTimeFormatter.format(date) : '—';
}

export function formatTime(value) {
  const date = toDate(value);
  return date ? timeFormatter.format(date) : '—';
}

export function formatWeekday(value) {
  const date = toDate(value);
  return date ? weekdayFormatter.format(date) : '—';
}

export function formatRelative(value) {
  const date = toDate(value);
  if (!date) return '—';
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return 'just now';
  if (abs < 90) return '1 min ago';
  if (abs < 3600) {
    const minutes = Math.round(abs / 60);
    return relativeFormatter.format(seconds < 0 ? -minutes : minutes, 'minute');
  }
  if (abs < 86_400) {
    const hours = Math.round(abs / 3600);
    return relativeFormatter.format(seconds < 0 ? -hours : hours, 'hour');
  }
  if (abs < 604_800) {
    const days = Math.round(abs / 86_400);
    return relativeFormatter.format(seconds < 0 ? -days : days, 'day');
  }
  return dateFormatter.format(date);
}

export function formatCurrencyINR(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return '—';
  return currencyFormatter.format(number);
}

export function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return numberFormatter.format(number);
}

export function formatWeight(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return '—';
  return `${number.toFixed(number < 10 ? 1 : 0)} kg`;
}

export function shortAddress(address = '') {
  if (!address) return '';
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function shortHash(hash = '') {
  if (!hash) return '';
  if (hash.length <= 18) return hash;
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

export function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function initials(name = '') {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '?'
  );
}

export function avatarHue(address = '') {
  let hash = 0;
  for (let index = 0; index < address.length; index += 1) {
    hash = (hash * 31 + address.charCodeAt(index)) >>> 0;
  }
  return hash % 360;
}

export function avatarColor(address = '', name = '') {
  const hue = avatarHue(address || name);
  return `linear-gradient(135deg, hsl(${hue} 42% 38%), hsl(${(hue + 28) % 360} 46% 30%))`;
}

export function timeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function isoDateInput(date = new Date()) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

export function toDateTimeLocalValue(date = new Date(Date.now() + 86_400_000)) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export function fromLocalInput(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function truncate(value = '', length = 80) {
  if (value.length <= length) return value;
  return `${value.slice(0, length - 1)}…`;
}
