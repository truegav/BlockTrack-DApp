'use strict';

/**
 * Caliper workload for the write path that creates an encrypted order.
 *
 * The benchmark deliberately uses dummy ciphertext and wrapped-key envelopes.
 * Caliper measures the EVM/RPC path (ABI encoding, gas, receipt finality); the
 * browser-side AES-GCM/ECIES work is measured separately by the crypto tests and
 * is not part of this benchmark. The contract validates lengths and holders but
 * does not decrypt anything.
 *
 * The primary admin is the Caliper deployer (Anvil account #0). The benchmark
 * account is Anvil account #1 and owns each order. Both are present in the
 * holder list, as the contract requires.
 */

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

const PRIMARY_ADMIN = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const CIPHERTEXT = `0x${'22'.repeat(200)}`;
const WRAPPED_KEY = `0x${'11'.repeat(129)}`;

class CreateOrderWorkload extends WorkloadModuleBase {
  constructor() {
    super();
    this.txIndex = 0;
  }

  async initializeWorkloadModule(
    workerIndex,
    totalWorkers,
    roundIndex,
    roundArguments,
    sutAdapter,
    sutContext
  ) {
    this.workerIndex = workerIndex;
    this.sutAdapter = sutAdapter;
    this.owner = sutContext.fromAddress;
    this.runId = Date.now().toString(36);
  }

  async submitTransaction() {
    this.txIndex += 1;
    const trackingId = `B${this.workerIndex}-${this.runId}-${this.txIndex}`.slice(0, 32);

    await this.sutAdapter.sendRequests({
      contract: 'BlockTrack',
      verb: 'createOrder',
      args: [
        trackingId,
        CIPHERTEXT,
        [this.owner, PRIMARY_ADMIN],
        [WRAPPED_KEY, WRAPPED_KEY],
      ],
    });
  }

  async cleanupWorkloadModule() {
    // No local resources to release.
  }
}

module.exports.createWorkloadModule = () => new CreateOrderWorkload();
