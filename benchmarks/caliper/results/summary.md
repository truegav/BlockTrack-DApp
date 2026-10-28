# Caliper benchmark summary

- **Run:** local Anvil · 28 Oct 2026
- **Tool:** Hyperledger Caliper 0.6.0 · `@hyperledger/caliper-ethereum` 0.6.0 · web3 1.2.6
- **Workers:** 1
- **Contract:** `0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE` (fresh deployment)
- **Result:** 2/2 rounds successful · benchmark finished in **32.1 s**

| Round | Success | Fail | Send rate (TPS) | Max latency | Min latency | Avg latency | Throughput (TPS) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `create-order` | 50 | 0 | 5.1 | 0.06 s | 0.04 s | 0.04 s | 5.1 |
| `public-status-read` | 100 | 0 | 20.2 | 0.00 s | 0.00 s | 0.00 s | 20.2 |

The full Caliper HTML report is [`report.html`](report.html).

## What was measured

- **`create-order`** — `BlockTrack.createOrder(trackingId, ciphertext, holders, wrappedKeys)` with a 200-byte dummy ciphertext and two 129-byte dummy key envelopes. The contract validates lengths, holder membership and the primary admin; no real client-side encryption runs in this round. The run is rate-controlled at 5 TPS to observe latency without saturating the single-worker adapter.
- **`public-status-read`** — `BlockTrack.getPublicStatus(trackingId)` on an order created in the workload setup, rate-controlled at 20 TPS.

## What was not measured

- Browser-side AES-256-GCM / ECIES work. That is covered by the pure crypto tests and is not part of the chain path.
- Multiple workers, remote Anvil, or a production network. The Ethereum Caliper adapter is single-node oriented and deprecated.
- UI rendering, wallet signing, event indexing or decryption of a full order list.

## Reproduce

```bash
npm run bench:install   # once
npm run dev             # Anvil on ws://127.0.0.1:8545
npm run bench           # deploy a scratch contract and run both rounds
```

The report is written to `benchmarks/caliper/results/report.html`; the console
output is kept in [`caliper.log`](caliper.log).

The numbers are local Anvil microbenchmarks with a fixed-rate workload. They are
useful for showing the Caliper integration and the relative cost of the write
versus read path — not for claiming production throughput.
