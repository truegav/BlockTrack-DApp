# Privacy model

This document describes what BlockTrack protects, what it does not protect, and where the
trust boundaries are. It is deliberately honest about the limits of privacy on a public
chain.

## Goals

1. Personal shipment data is **not** stored in plaintext anywhere: not on-chain, not in an
   API, not in a database, not on a server.
2. Only the customer, the operations admin, and the assigned courier can decrypt an order.
3. Anyone can verify that a status update was made by an authorised actor, without seeing
   the private payload.
4. A public tracking link reveals status and timestamps only.

## Non-goals

- Hiding that a wallet is involved in shipping, or the timing/volume of orders.
- Protecting against a compromised browser, a malicious wallet, or an attacker who already
  holds an authorised private key.
- Regulatory compliance (GDPR “right to erasure”, data residency, retention, etc.).
- Anonymous payments, identity verification, GPS tracking or a production courier API.
- Post-compromise revocation. See [Revocation](#revocation-and-key-rotation).

## Trust boundaries

| Component | Trusted for | Not trusted for |
| --- | --- | --- |
| **The chain** | Ordering, immutability, role checks, access to the audit trail | Confidentiality of ciphertext |
| **The RPC provider** | Returning correct chain data | Privacy — it sees your addresses, timing and ciphertext |
| **The browser** | Holding the vault key in memory, decrypting, encrypting | Integrity of a compromised device |
| **The wallet** | Signing the vault message and transactions | Storing the derived vault key |
| **Operations / admin** | Being a legitimate reader, dispatching correctly | Not reading customer data |
| **The contract** | Enforcing write permissions and state transitions | Read access — the contract cannot stop someone with a key from decrypting |

## Key hierarchy

### Vault key

The wallet's private key is never used as an encryption key. On session unlock the wallet
signs the exact message below (defined as `VAULT_MESSAGE` in
[`frontend/src/shared/crypto.js`](../frontend/src/shared/crypto.js)):

```
BlockTrack Vault Key v1

Signing this message derives a private encryption key inside your browser.
It does not create a transaction, move funds, or cost gas.
Only sign this message on the BlockTrack app.
```

The 65-byte signature is stretched with **HKDF-SHA256**:

- salt: `blocktrack.vault.v1`
- info: `secp256k1-aes256gcm`
- output: 32 bytes

Those 32 bytes are a secp256k1 private key. Its **uncompressed 65-byte public key** is
registered on-chain in the user's profile. The private vault key exists only in a
JavaScript `Uint8Array` in memory. Locking the vault fills it with zeroes, clears the
React Query cache, and unmounts the decrypted views.

The public key is displayed as a short fingerprint (`keccak256(publicKey)[0:8]`) in
Settings so a user can check that the registered key matches the current vault.

### Per-order keys

Every order gets a new random **32-byte** key from `crypto.getRandomValues`.

- The payload is encrypted with **AES-256-GCM**.
- A fresh random 12-byte IV is generated for each envelope.
- The envelope is `iv || ciphertext || tag` (the WebCrypto tag is appended).
- The associated data is `${trackingId}|payload|v1` for the order payload and
  `${trackingId}|note|v1` for notes. This binds ciphertext to one order and one purpose.

The order key is then wrapped with **ECIES over secp256k1** (`eciesjs`) for each reader's
registered public key. Only the resulting envelopes are stored on-chain.

```
profile: displayName + 65-byte encryption public key
order:   ciphertext + one wrapped key envelope per authorised reader
history: status + actor + timestamp + encrypted note envelope
```

### Key registration

A profile is created with `registerProfile(displayName, encryptionKey)`. The contract
checks the key is 65 bytes and begins with `0x04` (uncompressed secp256k1). `getProfile`
returns the current key. The app's `RequireProfile` guard compares the on-chain key with
the locally derived public key and shows a "key mismatch" gate if they differ, rather than
silently failing to decrypt.

## What is public on-chain

- Tracking ID (chosen by the browser, unique on the contract).
- Owner address and assigned courier address.
- Status transitions, actor addresses, timestamps.
- Display name and encryption public key of every registered user.
- The ciphertext length of an order and its encrypted notes.
- The number and timing of wrapped-key grants and revocations.
- The existence and roles of couriers/admins.

## What is encrypted

- Sender and recipient names and phone numbers.
- Full street addresses, cities, states, postal codes.
- Parcel description, category, weight, declared value, fragile flag.
- Service level and delivery instructions.
- Courier notes, location, ETA, proof-of-delivery signer.
- Cancellation reason.

## Access model

| Reader | How they get the order key | What they can do |
| --- | --- | --- |
| Customer | Wrapped for their public key at creation | Read, cancel before pickup |
| Admin | Wrapped for every admin at creation | Read all, dispatch, update, cancel |
| Courier | Wrapped by the admin at assignment | Read assigned orders, update status |
| Public | No envelope | Read status/timestamps only |
| Unassigned courier | No envelope | See nothing about the payload |

Write permissions are separate from read permissions and are enforced by the contract:

- Only the owner or an admin can cancel (owner only before pickup).
- Only the assigned courier or an admin can update status.
- A removed courier cannot update, but their old key envelopes remain on-chain. See below.

## Threat model

### A passive chain observer

Sees addresses, status changes, timestamps, ciphertext lengths and the public profile
metadata. Cannot read names, addresses, parcel contents or notes. Can correlate addresses
and infer business relationships from timing and frequency.

### The RPC provider

Sees the same as a chain observer plus the IP address of the browser. It can censor or
return incorrect data, but cannot decrypt. A privacy-conscious deployment should consider
a self-hosted RPC or a privacy-preserving gateway.

### Another customer

Only receives `OrderCreated` events for their own address (the app filters by owner). Even
if they query all events, every other order's wrapped keys are encrypted for someone else;
without that person's vault key they cannot unwrap the order key.

### An unassigned courier

Cannot read the order payload because no wrapped key exists for their address. They can see
the order ID and public status if they query the chain, but the current UI does not show
unassigned orders in their queue.

### Operations / admin

**Can read every order.** This is a deliberate operational requirement: dispatch and
support need the recipient details and the ability to fix a shipment. It is also the
largest trust boundary in the prototype. Production should consider threshold key
management, split admin roles, and auditable access policies.

### A compromised browser or wallet

The vault key lives in memory while unlocked. A compromised tab, a malicious extension, or
a wallet that signs a different message can read or redirect data. The app locks the vault
on demand and clears it on account changes, but it cannot protect a compromised device.
Use a dedicated browser profile and hardware wallet for real data.

### Replay / moving ciphertext

The tracking ID is included as AAD for payload and notes. Ciphertext encrypted for order A
will fail authentication if stored under order B. The contract also enforces unique
tracking IDs and legal status transitions.

### Losing a wallet

There is no recovery server. If the wallet is lost, the vault key cannot be re-derived and
the order payloads cannot be decrypted by that user. The admin still holds a key for every
order, so operations can recover a shipment operationally, but that is a governance
decision, not a cryptographic user recovery feature.

## Revocation and key rotation

`assignCourier` writes a new wrapped key for the new courier and removes the previous
courier's on-chain envelope. That stops future decryption by the old courier **only if they
have not already decrypted the payload**. A reader who has already seen plaintext retains
it. True revocation requires a new order key, re-encryption of the payload and notes, and
new envelopes for the remaining readers — not implemented here.

Removing a courier role stops future status updates. It does not revoke key envelopes that
were already written.

## Metadata leakage

Encryption hides content, not the fact that two addresses are doing business. The following
remain observable:

- Which wallet created and owns an order.
- Which courier was assigned, and when.
- Status timing and the number of updates.
- Ciphertext size (roughly the amount of detail in the payload).
- The admin's identity (the deployer address) and the courier roster.
- The browser's IP address at the RPC provider.

A production privacy design would need to address traffic analysis, relaying, address
rotation, and possibly padding. Those are outside this prototype.

## Why there is no backend

A backend would add a server that sees plaintext, a database that must be protected, an
account system, and a second source of truth. The requirement for this project was a
front-end that talks directly to the chain. That keeps the trust surface small, but it
also means:

- No server-side search or indexing: the browser filters events it can query.
- No password reset or account recovery.
- No email/push notifications: the notification feed is derived locally.
- No server-side rate limiting or abuse controls.

At production scale, an indexer that reads only non-sensitive event fields would be a
reasonable middle ground; it still would not be able to decrypt.

## Regulatory note

Encrypted personal data is still personal data in many jurisdictions. A public, immutable
chain creates tension with erasure and retention obligations. The "status-only public"
design reduces exposure but does not make this deployment compliant. A real deployment
needs legal review, a data-protection impact assessment, retention policy, and a clear
controller/processor model. The ciphertext cannot be deleted from the chain.

## Cryptographic choices and caveats

- **AES-256-GCM**: authenticated encryption, random 96-bit IV per envelope, AAD binding.
- **HKDF-SHA256**: RFC 5869 derivation with a fixed salt and info.
- **secp256k1 / ECIES**: compatible with Ethereum keys, but ECIES is an application-level
  protocol, not a standardised Ethereum primitive. `eciesjs` is a small library and is not
  audited for this use case.
- **Signature determinism**: the vault key must be reproducible from the same signature.
  The app checks the derived public key against the on-chain key and shows a mismatch gate.
  Wallets that produce different signatures for the same message would need a different
  derivation design (for example, a random key encrypted to the wallet key).
- **No forward secrecy**: compromising a vault key compromises every order envelope ever
  wrapped for it.
- **No key rotation**: the vault key stays the same until the wallet changes.
- **Unaudited**: neither the contract nor the client crypto has been audited. Do not use
  with real personal data.

## What an auditor can verify on-chain

- That each status update was sent by an authorised address.
- That the state machine was respected.
- That the owner and courier key envelopes exist (or were removed).
- That the ciphertext for an order exists and has a given length.
- The timestamps and ordering of every transition.

They cannot verify the contents, and they cannot prove that an authorised reader did not
decrypt and copy the data.

## Demo warning

The demo accounts use Anvil's publicly known development private keys. They are worthless
and must never be used on a real network. All names, addresses and parcel details in the
seed data are fictional. The app is a local prototype.
