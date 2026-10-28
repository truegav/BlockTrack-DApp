const PREFIX = 'bt.';

export function readString(key, fallback = null) {
  try {
    const value = window.localStorage.getItem(PREFIX + key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

export function writeString(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, value);
  } catch {
    // Storage can be unavailable in private browsing; non-fatal.
  }
}

export function removeKey(key) {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

export function readJson(key, fallback = null) {
  const raw = readString(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJson(key, value) {
  writeString(key, JSON.stringify(value));
}
