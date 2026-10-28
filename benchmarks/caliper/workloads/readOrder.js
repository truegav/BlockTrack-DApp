'use strict';

/**
 * Caliper workload for the public status read path.
 *
 * Before the timed round starts, one order is created so `getPublicStatus` has a
 * real record to read. The setup transaction is not part of the timed requests.
 */

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

const PRIMARY_ADMIN = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const CIPHERTEXT = `0x${'22'.repeat(200)}`;
const WRAPPED_KEY = `0x${'11'.repeat(129)}`;

class ReadOrderWorkload extends WorkloadModuleBase {
  constructor() {
    super();
    this.readId = null;
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
    this.readId = `R${workerIndex}-${Date.now().toString(36)}`.slice(0, 32);

    // Seed one order for the timed reads. A failed setup should make the
    // benchmark fail loudly rather than silently benchmarking misses.
    await this.sutAdapter.sendRequests({
      contract: 'BlockTrack',
      verb: 'createOrder',
      args: [
        this.readId,
        CIPHERTEXT,
        [this.owner, PRIMARY_ADMIN],
        [WRAPPED_KEY, WRAPPED_KEY],
      ],
    });
  }

  async submitTransaction() {
    await this.sutAdapter.sendRequests({
      contract: 'BlockTrack',
      verb: 'getPublicStatus',
      readOnly: true,
      args: [this.readId],
    });
  }

  async cleanupWorkloadModule() {
    // No local resources to release.
  }
}

module.exports.createWorkloadModule = () => new ReadOrderWorkload();
