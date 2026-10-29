/**
 * Snapshot of the committed Caliper run.
 *
 * This file is intentionally static: the website is a static SPA and the
 * benchmark is an optional, offline harness. To refresh the page, run
 * `npm run bench`, update these numbers (or generate this file), and redeploy.
 */
export const CALIPER_RUN = {
  tool: 'Hyperledger Caliper',
  toolVersion: '0.6.0',
  adapter: '@hyperledger/caliper-ethereum',
  adapterVersion: '0.6.0',
  chain: 'Anvil',
  chainId: 31337,
  dateLabel: '28 Oct 2026',
  durationSeconds: 32.1,
  workers: 1,
  roundsSuccessful: 2,
  roundsTotal: 2,
  contractLabel: 'Scratch BlockTrack deployment',
  reportPath: '/benchmarks/caliper-report.html',
  rounds: [
    {
      key: 'create-order',
      label: 'Create order',
      kind: 'write',
      typeLabel: 'Write',
      description:
        'Creates an order with a 200-byte ciphertext and two 129-byte wrapped key envelopes.',
      transactions: 50,
      success: 50,
      failed: 0,
      configuredTps: 5,
      sendRate: 5.1,
      throughput: 5.1,
      latency: { avg: 0.04, min: 0.04, max: 0.06 },
    },
    {
      key: 'public-status-read',
      label: 'Public status read',
      kind: 'read',
      typeLabel: 'Read',
      description:
        'Reads status and timestamps through the status-only public getter.',
      transactions: 100,
      success: 100,
      failed: 0,
      configuredTps: 20,
      sendRate: 20.2,
      throughput: 20.2,
      latency: { avg: 0, min: 0, max: 0 },
    },
  ],
};
