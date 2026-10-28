export const TRACKING_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomTrackingSuffix(length = 6) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = '';
  for (let index = 0; index < length; index += 1) {
    out += TRACKING_ALPHABET[bytes[index] % TRACKING_ALPHABET.length];
  }
  return out;
}

export function generateTrackingId() {
  return `BT-${randomTrackingSuffix(6)}`;
}

export function normalizeTrackingId(value = '') {
  return value.trim().toUpperCase();
}

export function isValidTrackingId(value = '') {
  return /^BT-[A-Z0-9]{4,12}$/.test(normalizeTrackingId(value));
}
