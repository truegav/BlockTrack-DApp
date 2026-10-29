# Viva / demo script

A 5–7 minute walkthrough of the privacy properties and the full user flow. It assumes
`npm run dev` is running at <http://127.0.0.1:5173> with a fresh seed.

Full written report: [docs/report/BlockTrack-Project-Report.pdf](report/BlockTrack-Project-Report.pdf).

## Before you start

```bash
npm run dev          # Anvil + deploy + seed + Vite
# open http://127.0.0.1:5173
```

Use the demo account buttons. Do not use MetaMask for the scripted flow; the Anvil personas
open instantly and already have profiles registered.

Optional reset:

```bash
# Ctrl+C the dev server, then
npm run dev
```

## The 5-minute path

### 1. Customer creates an encrypted order (90 s)

1. Sign in as **Rohan Mehta** (customer, Bengaluru).
2. Show the dashboard: active shipments, next delivery, progress rail.
3. Click **New order**.
4. Fill the route (the sender name is prefilled; use any fictional address).
5. Continue to **Parcel**; add a description and weight.
6. On **Review**, point at the privacy callout: *“A random order key encrypts this payload.
   The key is wrapped for you and operations.”*
7. Click **Encrypt & register**. One wallet transaction is written; the app navigates to
   the order detail.
8. On the detail, show:
   - the decrypted recipient and parcel details;
   - the **Journey** rail and timeline;
   - **Who can read this** (owner + operations);
   - **Chain record** — the ciphertext and transaction hash, not the plaintext.

**Talking point:** the plaintext existed only in the browser. The chain got an AES-GCM
envelope and ECIES-wrapped keys.

### 2. Admin dispatches it (60 s)

1. Switch to **Maya Sharma** (admin).
2. Open **Dispatch**. Point out the unassigned order and the **Key hand-off** callout.
3. Click **Assign**, choose **Priya Nair**, confirm.
4. Open the order detail and show the courier and the key holders.
5. If asked: the admin's browser unwraps the order key with the admin vault key, then
   rewraps it for Priya's registered public key. The chain only receives the new envelope.

### 3. Courier updates it (60 s)

1. Switch to **Priya Nair** (courier).
2. Open **Delivery queue** — only Priya's assigned orders are visible.
3. Open the order and click **Update status**.
4. Choose **Picked up**, add a note and a location, submit.
5. Show the timeline note and the progress rail.

**Talking point:** the note was encrypted with the same order key before the transaction.

### 4. Customer reads the update (30 s)

1. Switch back to **Rohan Mehta**.
2. Open the order. The courier note, location and timeline are decrypted locally.
3. Show that the note was not in the transaction calldata. The chain record contains only
   ciphertext.

### 5. Public tracker (45 s)

1. Open a new tab to <http://127.0.0.1:5173/track/BT-7K4M2Q>.
2. Show the status, rail and timeline.
3. Point out what is **not** there: no recipient, no address, no parcel, no notes, no ETA.
4. Optionally search the tracking ID from the public landing page.

**Talking point:** the public view uses separate getters that return only status and
timestamps. It is not a filtered version of the private view.

### 6. Privacy model page (45 s)

1. Open **How privacy works** (`/privacy`).
2. Walk the envelope model: encrypt → wrap → anchor → decrypt.
3. Show the “What the chain sees” split and the honest limits.
4. Highlight the derivation code block and the role table.

### 7. Vault lock (30 s)

1. Sign in as any demo account.
2. Click the **Vault open** chip in the top bar (it locks directly).
3. Show the unlock gate: decrypted data is gone; the URL stays but the app requires a
   signature.
4. Click **Sign to unlock** and return to the dashboard.

**Talking point:** the vault key is memory-only. Locking zeroes it and clears the query
cache. A signature is not a transaction and costs no gas.

### 8. Tests (30 s, optional)

```bash
npm test
```

Expected: 34 Foundry tests and 7 crypto tests pass. If there is time, show the status
machine/role tests in `test/BlockTrack.t.sol`.

### 9. Caliper benchmark (optional, ~40 s)

```bash
npm run bench:install   # once, if not already installed
npm run bench           # Anvil must already be running
```

Open **http://127.0.0.1:5173/benchmarks** first — it presents the two-round
Caliper snapshot without a login. The underlying run deploys a scratch contract
and executes 50 `createOrder` writes at 5 TPS and 100 `publicStatus` reads at
20 TPS. The native report is linked from that page; the raw files live in
`benchmarks/caliper/results/`.

**Talking point:** Caliper measures the chain/RPC path. It deliberately does not
measure the browser AES-GCM/ECIES work; that is covered by the crypto tests. The
Ethereum Caliper adapter is deprecated and uses web3 1.2, which is fine for this
local demonstration but not a production benchmark. The harness uses a small
runner because the Caliper 0.6 CLI's yargs loader does not register commands on
Node 26.

## Architecture in one breath

> A static React app reads and writes directly to the contract. Each order has a random
> AES-256-GCM key. That key is ECIES-wrapped for the customer and operations at creation,
> and for the courier at assignment. The vault key comes from a wallet signature stretched
> with HKDF. The chain stores ciphertext, wrapped keys, addresses, status and timestamps.
> No server sees plaintext.

## Likely questions

| Question | Short answer |
| --- | --- |
| Why use a blockchain at all? | Tamper-evident, multi-party audit trail with no backend or central database. The status history is verifiable by anyone. |
| If the chain is public, what is private? | Names, phones, addresses, parcel details, instructions, notes, ETAs and cancellation reasons. Addresses, timing and status remain public metadata. |
| How does the customer get the key? | The admin/customer wraps the order key for the customer's registered public key at creation. The customer unwraps it with their vault key. |
| How does the courier get the key? | The admin unwraps the order key locally and rewraps it for the courier when assigning. Only the new envelope goes on-chain. |
| Can the admin read everything? | Yes. Operations is a deliberate trust boundary for dispatch and support. A production system should use threshold/multi-party access. |
| Can a removed courier still read it? | They lose the on-chain envelope, but anyone who already decrypted the payload keeps a copy. True revocation requires key rotation; the docs say so. |
| What happens if I lose my wallet? | There is no recovery server; the vault key cannot be re-derived. Operations still has a key for support, but that is not user recovery. |
| Is the data GDPR compliant? | No claim. Encrypted personal data is still personal data, and an immutable chain conflicts with erasure. This is a prototype. |
| Why not a normal database? | That was the project constraint: no backend. The trade-off is cost, permanence and no server-side search. |
| How is the public tracker limited? | It calls `getPublicStatus` / `getPublicHistory`, which return status, actor and timestamps only. It never receives the ciphertext. |
| Can someone move ciphertext to another order? | The tracking ID is AES-GCM associated data (`trackingId|payload|v1`), so authentication fails under a different ID. |
| Why not put the payload on IPFS? | For the demo, 8 KiB on-chain is simpler. Production should anchor a CID/hash and keep the blob off-chain. |
| How do you scale the order list? | At 10 orders the browser scans events. Production needs an indexer that reads only public fields; decryption still happens client-side. |
| What is the biggest risk? | The admin trust boundary and browser compromise, plus metadata leakage. The contract is unaudited and the crypto is application-level. |
| Why Anvil keys? | Convenience for the demo. They are publicly known, have no value and must never be used on a real network. |
| Why Caliper? | It is the standard Hyperledger benchmarking harness and gives a reproducible report for the contract path. It is a separate, optional harness, not part of the app runtime. |
| Why don't the Caliper numbers include encryption? | Caliper is chain-level. The browser crypto and UI are measured by the crypto tests and E2E; mixing them into Caliper would measure the wrong system. |
| Are the Caliper numbers production numbers? | No. They are single-worker local Anvil microbenchmarks, useful for showing the integration and relative write/read cost. |

## What not to claim

- “The data is anonymous.” It is encrypted, but addresses and timing are visible.
- “Revocation is complete.” Only the on-chain envelope is removed; plaintext already read
  cannot be recalled.
- “This is production-ready.” It is an unaudited prototype with demo keys.
- “The admin cannot read it.” Operations holds a key for every order.
- “Ciphertext is not personal data.” It can be; this is not a legal conclusion.

## If the demo breaks

- **Anvil unavailable:** stop the old dev server and run `npm run dev` again.
- **Wrong or stale contract:** stop the dev server, delete `frontend/public/deployment.json`
  (`npm run demo:reset`), then `npm run dev`.
- **Vault stuck locked:** click **Sign to unlock**; demo personas need no MetaMask.
- **No orders / empty dashboards:** check that the seed log says
  `Seed complete: 10 orders, 7 assignments, 21 timeline updates`.
- **E2E leftovers:** the smoke test creates and cancels a test order; reset the chain before
  a formal demo if a clean graph matters.
- **Chrome not found for tests:** set `CHROME_PATH` to a Chrome/Chromium binary.
