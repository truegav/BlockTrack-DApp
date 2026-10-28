import test from 'node:test';
import assert from 'node:assert/strict';
import { Wallet, getBytes, hexlify } from 'ethers';
import {
  VAULT_MESSAGE,
  deriveVaultKey,
  encryptNote,
  decryptNote,
  decryptPayload,
  encryptPayload,
  generateOrderKey,
  keyFingerprint,
  toHex,
  unwrapOrderKey,
  vaultPublicKey,
  vaultPublicKeyBytes,
  wrapOrderKey,
} from './crypto.js';

const TRACKING = 'BT-9K2M4Q';

async function persona() {
  const wallet = Wallet.createRandom();
  const signature = await wallet.signMessage(VAULT_MESSAGE);
  const vaultKey = await deriveVaultKey(signature);
  const publicKey = vaultPublicKey(vaultKey);
  return { wallet, signature, vaultKey, publicKey };
}

test('vault key derivation is deterministic and wallet-scoped', async () => {
  const wallet = Wallet.createRandom();
  const sigA = await wallet.signMessage(VAULT_MESSAGE);
  const sigB = await wallet.signMessage(VAULT_MESSAGE);
  assert.equal(sigA, sigB);

  const keyA = await deriveVaultKey(sigA);
  const keyB = await deriveVaultKey(sigB);
  assert.equal(keyA.length, 32);
  assert.equal(toHex(keyA), toHex(keyB));

  const other = Wallet.createRandom();
  const otherKey = await deriveVaultKey(await other.signMessage(VAULT_MESSAGE));
  assert.notEqual(toHex(keyA), toHex(otherKey));
});

test('vault public key is a valid 65-byte uncompressed secp256k1 key', async () => {
  const { vaultKey, publicKey } = await persona();
  assert.equal(getBytes(publicKey).length, 65);
  assert.equal(getBytes(publicKey)[0], 4);
  assert.equal(toHex(vaultPublicKeyBytes(vaultKey)), publicKey);
  assert.match(keyFingerprint(publicKey), /^0x[0-9a-f]{16}$/);
});

test('order key wraps and unwraps only for the intended recipient', async () => {
  const alice = await persona();
  const bob = await persona();
  const orderKey = generateOrderKey();

  const wrappedForAlice = wrapOrderKey(orderKey, alice.publicKey);
  const wrappedForBob = wrapOrderKey(orderKey, bob.publicKey);

  assert.equal(toHex(unwrapOrderKey(wrappedForAlice, alice.vaultKey)), toHex(orderKey));
  assert.equal(toHex(unwrapOrderKey(wrappedForBob, bob.vaultKey)), toHex(orderKey));

  assert.throws(() => unwrapOrderKey(wrappedForAlice, bob.vaultKey));
  assert.throws(() => unwrapOrderKey(new Uint8Array(), alice.vaultKey));
});

test('payload encryption round-trips and is bound to the tracking ID', async () => {
  const { vaultKey } = await persona();
  const orderKey = generateOrderKey();
  const payload = {
    v: 1,
    sender: { name: 'Rohan Mehta', phone: '+91 98765 43210', city: 'Bengaluru' },
    recipient: { name: 'Neha Kulkarni', phone: '+91 99887 76655', city: 'Mumbai' },
    parcel: { description: 'Books', weightKg: 2.4, declaredValue: 12500 },
    instructions: 'Call before delivery.',
  };

  const envelope = await encryptPayload(payload, orderKey, TRACKING);
  assert.ok(envelope.length > 12);
  const decrypted = await decryptPayload(envelope, orderKey, TRACKING);
  assert.deepEqual(decrypted, payload);

  await assert.rejects(() => decryptPayload(envelope, orderKey, 'BT-WRONG'));
  await assert.rejects(() => decryptPayload(envelope, generateOrderKey(), TRACKING));
});

test('tampered ciphertext is rejected', async () => {
  const orderKey = generateOrderKey();
  const envelope = await encryptPayload({ hello: 'world' }, orderKey, TRACKING);
  envelope[envelope.length - 1] ^= 0xff;
  await assert.rejects(() => decryptPayload(envelope, orderKey, TRACKING));
});

test('notes round-trip with their own AAD', async () => {
  const orderKey = generateOrderKey();
  const note = {
    v: 1,
    note: 'Arrived at the local delivery centre.',
    location: 'Indiranagar, Bengaluru',
    eta: '2026-10-30T18:00:00.000Z',
  };
  const envelope = await encryptNote(note, orderKey, TRACKING);
  const decrypted = await decryptNote(envelope, orderKey, TRACKING);
  assert.deepEqual(decrypted, note);

  await assert.rejects(() => decryptPayload(envelope, orderKey, TRACKING));
});

test('order keys are 32 bytes and unique', () => {
  const a = generateOrderKey();
  const b = generateOrderKey();
  assert.equal(a.length, 32);
  assert.equal(b.length, 32);
  assert.notEqual(hexlify(a), hexlify(b));
});
