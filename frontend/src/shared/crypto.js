import { SigningKey, getBytes, hexlify, keccak256, toUtf8Bytes } from 'ethers';
import { encrypt as eciesEncrypt, decrypt as eciesDecrypt } from 'eciesjs';

/**
 * BlockTrack client-side crypto.
 *
 * The wallet's private key is never used for encryption. Instead the user signs
 * a fixed, domain-separated message once per session. That signature is stretched
 * through HKDF-SHA256 into a separate secp256k1 "vault key" that lives only in
 * memory. The public half is registered on-chain so other people can wrap order
 * keys for this user.
 *
 * Each order gets its own random 32-byte AES-256-GCM key. The order key is wrapped
 * (ECIES over secp256k1) for every authorized recipient and stored on-chain. The
 * payload ciphertext is stored on-chain as well. Nothing plaintext ever leaves the
 * browser.
 */

export const VAULT_MESSAGE = [
  'BlockTrack Vault Key v1',
  '',
  'Signing this message derives a private encryption key inside your browser.',
  'It does not create a transaction, move funds, or cost gas.',
  'Only sign this message on the BlockTrack app.',
].join('\n');

export const SCHEMA_VERSION = 'v1';
export const ORDER_KEY_BYTES = 32;
export const PUBLIC_KEY_BYTES = 65;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const HKDF_SALT = toUtf8Bytes('blocktrack.vault.v1');
const HKDF_INFO = toUtf8Bytes('secp256k1-aes256gcm');

function subtle() {
  const webcrypto = globalThis.crypto;
  if (!webcrypto || !webcrypto.subtle) {
    throw new Error(
      'WebCrypto is unavailable. Open BlockTrack over localhost or HTTPS.'
    );
  }
  return webcrypto.subtle;
}

function randomBytes(length) {
  const webcrypto = globalThis.crypto;
  if (!webcrypto || !webcrypto.getRandomValues) {
    throw new Error('Secure random numbers are unavailable in this browser.');
  }
  return webcrypto.getRandomValues(new Uint8Array(length));
}

export function toBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (typeof value === 'string') return getBytes(value);
  throw new TypeError('Unsupported byte value.');
}

export function toHex(value) {
  return hexlify(toBytes(value));
}

export function zeroize(...values) {
  for (const value of values) {
    if (value instanceof Uint8Array) value.fill(0);
  }
}

/**
 * Derive the 32-byte vault key from a wallet signature.
 * The signature must come from VAULT_MESSAGE.
 */
export async function deriveVaultKey(signature) {
  const signatureBytes = toBytes(signature);
  if (signatureBytes.length !== 65) {
    throw new Error('Unexpected signature length.');
  }

  const keyMaterial = await subtle().importKey(
    'raw',
    signatureBytes,
    'HKDF',
    false,
    ['deriveBits']
  );

  const bits = await subtle().deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: HKDF_SALT,
      info: HKDF_INFO,
    },
    keyMaterial,
    256
  );

  return new Uint8Array(bits);
}

/** 65-byte uncompressed secp256k1 public key, hex encoded. */
export function vaultPublicKey(vaultKey) {
  const key = toBytes(vaultKey);
  if (key.length !== ORDER_KEY_BYTES) {
    throw new Error('Invalid vault key length.');
  }
  return new SigningKey(key).publicKey;
}

export function vaultPublicKeyBytes(vaultKey) {
  return getBytes(vaultPublicKey(vaultKey));
}

/** Short public-key fingerprint for display, e.g. 0x12ab34cd56ef7890. */
export function keyFingerprint(publicKey) {
  return keccak256(toBytes(publicKey)).slice(0, 18);
}

export function generateOrderKey() {
  return randomBytes(ORDER_KEY_BYTES);
}

/**
 * ECIES-wrap an order key for a recipient's registered public key.
 * Returns the encrypted envelope bytes to store on-chain.
 */
export function wrapOrderKey(orderKey, recipientPublicKey) {
  const key = toBytes(orderKey);
  if (key.length !== ORDER_KEY_BYTES) {
    throw new Error('Invalid order key length.');
  }
  const publicKey = toBytes(recipientPublicKey);
  if (publicKey.length !== PUBLIC_KEY_BYTES) {
    throw new Error('Invalid recipient public key length.');
  }
  return eciesEncrypt(hexlify(publicKey), key);
}

/** Unwrap an on-chain wrapped order key using the local vault key. */
export function unwrapOrderKey(wrappedKey, vaultKey) {
  const wrapped = toBytes(wrappedKey);
  if (wrapped.length === 0) {
    throw new Error('This wallet has no wrapped key for the order.');
  }
  const key = toBytes(vaultKey);
  if (key.length !== ORDER_KEY_BYTES) {
    throw new Error('Invalid vault key length.');
  }
  const orderKey = eciesDecrypt(hexlify(key), wrapped);
  if (orderKey.length !== ORDER_KEY_BYTES) {
    throw new Error('Unwrapped order key has an unexpected length.');
  }
  return orderKey;
}

function additionalData(trackingId, kind) {
  return encoder.encode(`${trackingId}|${kind}|${SCHEMA_VERSION}`);
}

async function encryptEnvelope(data, orderKey, trackingId, kind) {
  const key = toBytes(orderKey);
  if (key.length !== ORDER_KEY_BYTES) throw new Error('Invalid order key.');
  const iv = randomBytes(12);
  const cryptoKey = await subtle().importKey('raw', key, 'AES-GCM', false, [
    'encrypt',
  ]);
  const plaintext = encoder.encode(JSON.stringify(data));
  const ciphertext = await subtle().encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: additionalData(trackingId, kind),
    },
    cryptoKey,
    plaintext
  );

  const envelope = new Uint8Array(iv.length + ciphertext.byteLength);
  envelope.set(iv, 0);
  envelope.set(new Uint8Array(ciphertext), iv.length);
  return envelope;
}

async function decryptEnvelope(envelope, orderKey, trackingId, kind) {
  const bytes = toBytes(envelope);
  if (bytes.length < 12 + 16) {
    throw new Error('Encrypted payload is truncated.');
  }
  const key = toBytes(orderKey);
  if (key.length !== ORDER_KEY_BYTES) throw new Error('Invalid order key.');

  const iv = bytes.slice(0, 12);
  const ciphertext = bytes.slice(12);
  const cryptoKey = await subtle().importKey('raw', key, 'AES-GCM', false, [
    'decrypt',
  ]);

  const plaintext = await subtle().decrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: additionalData(trackingId, kind),
    },
    cryptoKey,
    ciphertext
  );

  return JSON.parse(decoder.decode(plaintext));
}

export function encryptPayload(payload, orderKey, trackingId) {
  return encryptEnvelope(payload, orderKey, trackingId, 'payload');
}

export function decryptPayload(envelope, orderKey, trackingId) {
  return decryptEnvelope(envelope, orderKey, trackingId, 'payload');
}

export function encryptNote(note, orderKey, trackingId) {
  return encryptEnvelope(note, orderKey, trackingId, 'note');
}

export function decryptNote(envelope, orderKey, trackingId) {
  return decryptEnvelope(envelope, orderKey, trackingId, 'note');
}

/** Canonical-ish helper for display. */
export function shortAddress(address = '') {
  if (!address) return '';
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
