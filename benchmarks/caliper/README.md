# BlockTrack · Caliper benchmarks

An optional [Hyperledger Caliper](https://hyperledger.github.io/caliper/) harness
for the `BlockTrack` contract. It is intentionally separate from the app and
from `npm test`: Caliper measures the chain path, not the browser encryption.

## Result (local Anvil)

Run on 28 Oct 2026 with Caliper 0.6.0, `@hyperledger/caliper-ethereum` 0.6.0 and
Anvil on `ws://127.0.0.1:8545`. One worker, fixed-rate workload.

| Round | Success | Fail | Send rate (TPS) | Max latency | Min latency | Avg latency | Throughput (TPS) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `create-order` | 50 | 0 | 5.1 | 0.06 s | 0.04 s | 0.04 s | 5.1 |
| `public-status-read` | 100 | 0 | 20.2 | 0.00 s | 0.00 s | 0.00 s | 20.2 |

- Benchmark duration: **32.1 s**, 2/2 rounds successful.
- Full output: [`results/report.html`](results/report.html) ·
  [`results/summary.md`](results/summary.md) ·
  [`results/caliper.log`](results/caliper.log).

These are local microbenchmark numbers, not production throughput claims. They
show the Caliper integration and the relative cost of the write and read paths.

## Quick start

From the repository root:

```bash
npm run bench:install   # once; installs the Caliper CLI and core packages
npm run dev             # starts Anvil + the app; ws://127.0.0.1:8545
npm run bench           # regenerates the contract artifact, deploys a scratch
                        # contract and runs both rounds
```

`npm run bench` writes:

- `benchmarks/caliper/results/report.html` — Caliper's native report.
- `benchmarks/caliper/results/caliper.log` — console output.
- A scratch `BlockTrack` deployment on the running Anvil. The app's contract and
  data are untouched.

## Files

```
benchmarks/caliper/
  package.json                  Caliper 0.6 deps and npm scripts
  run.cjs                       CaliperEngine runner (Node 26 workaround)
  networks/anvil.json           WebSocket RPC, accounts, contract gas
  benchmarks/benchconfig.yaml   Two fixed-rate rounds
  workloads/createOrder.js      Timed createOrder writes
  workloads/readOrder.js        Timed getPublicStatus reads
  contracts/BlockTrack.json     Generated ABI + bytecode + deployment gas
  results/                      Committed report, summary and console log
  scripts/caliper-contract.mjs  (root) Foundry artifact → contract definition
```

## What is measured

### `create-order` · 5 TPS, 50 transactions

`BlockTrack.createOrder(trackingId, ciphertext, holders, wrappedKeys)` with:

- a 200-byte dummy ciphertext;
- two 129-byte dummy wrapped-key envelopes;
- the benchmark account as owner and the deployer as primary admin (both are
  required holders by the contract);
- a unique tracking ID per transaction.

The contract validates lengths, holder uniqueness, owner/admin presence and
tracking-ID uniqueness. It does not decrypt anything. This isolates the EVM and
RPC path from browser AES-GCM/ECIES work.

### `public-status-read` · 20 TPS, 100 queries

The workload creates one order in `initializeWorkloadModule`, then times
`getPublicStatus(trackingId)` calls. This exercises the public, status-only
read path used by the tracker.

## What is not measured

- Browser AES-256-GCM / ECIES encryption or decryption.
- Wallet signature prompts and the vault-key derivation.
- React rendering, event indexing, decryption of N orders, or notifications.
- A production network, multiple workers or a realistic load balancer.

The pure crypto tests (`npm run test:crypto`) cover the encryption primitives;
the browser E2E (`npm run test:e2e`) covers the full user flow.

## Why a custom runner instead of `caliper launch manager`?

Caliper 0.6.0's CLI uses `yargs@15`. On Node 26, its `commandDir` loader does not
register the `launch` commands, so `caliper launch manager ...` only prints the
global help. The runner uses the same components as the CLI's launch manager:

```js
const engine = new CaliperEngine(benchmarkConfig, networkConfig, connectorFactory);
const code = await engine.run();
```

It also handles the forked worker process (`launch worker`), because Caliper's
`worker-orchestrator` forks `process.argv[1]`. This is still Caliper 0.6: same
engine, same `@hyperledger/caliper-ethereum` connector, same workers and report
builder. On Node 20, `npm run bench:cli` runs the stock CLI if you prefer.

## Caliper / adapter caveats

- The Ethereum adapter is **deprecated**. It uses web3.js 1.2.x and is tested by
  its maintainers against Besu and Geth, not Anvil. It works here because Anvil
  exposes standard JSON-RPC over WebSocket.
- HTTP RPC is rejected by the adapter; the config uses `ws://127.0.0.1:8545`.
  Anvil serves both HTTP and WebSocket on its default port.
- The adapter deploys every contract in `networks/anvil.json` at startup. The
  benchmark contract is a fresh deployment, not the app's deployment.
- `contracts/BlockTrack.json` is generated from the Foundry artifact. Regenerate
  it with `node scripts/caliper-contract.mjs` after changing the contract.
- The network config uses Anvil's publicly known development keys. They have no
  value and must never be used on a real network.

## Accounts

| Role | Anvil account | Address |
| --- | --- | --- |
| Deployer / primary admin | #0 | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` |
| Benchmark owner | #1 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` |

Account #1 is funded by Anvil. The contract's `createOrder` requires the caller
(owner) and the primary admin to be in the holder list; both are.

## Adding a round

1. Add a workload module to `workloads/`.
2. Add a round to `benchmarks/benchconfig.yaml` with a `rateControl` and a
   `txNumber` or `txDuration`.
3. Add any new function gas to `networks/anvil.json` under
   `ethereum.contracts.BlockTrack.gas`.
4. If the contract changed, run `npm run bench:prepare`.

Example round:

```yaml
- label: order-history-read
  description: Read the full on-chain status history.
  txNumber: 100
  rateControl:
    type: fixed-rate
    opts:
      tps: 20
  workload:
    module: workloads/readHistory.js
```

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Ethereum benchmarks must not use http(s)` | Use `ws://127.0.0.1:8545`; start Anvil with `npm run dev`. |
| `Missing out/BlockTrack.sol/BlockTrack.json` | Run `forge build` (or `npm run dev`) then `npm run bench`. |
| `ECONNREFUSED` | Anvil is not running; start `npm run dev`. |
| `insufficient funds` | The benchmark uses Anvil account #1; make sure the chain is a standard Anvil chain. |
| `nonce too low` | Restart Anvil (`Ctrl+C` the dev server, then `npm run dev`) or wait for the adapter's nonce sync. |
| CLI prints only help | Node 26 + yargs bug; use `npm run bench` (the runner), not `caliper launch manager`. |
| Report chart is empty | The native report loads Chart.js from a CDN; the tables and metrics are still valid offline. |

## Security note

The benchmark is a local development tool. It deploys a scratch contract and
uses public Anvil keys. Do not point it at a production chain, and do not reuse
the demo keys.
