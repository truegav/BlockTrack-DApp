import {
  RPC_URL,
  contractAt,
  makeProvider,
  readDeployment,
} from './lib/chain.mjs';
import { seedDemo } from './lib/seed.mjs';

const deployment = readDeployment();
if (!deployment?.contractAddress) {
  console.error(
    'No deployment found. Run `npm run dev` (which deploys automatically) or `npm run deploy` first.'
  );
  process.exit(1);
}

const provider = makeProvider(deployment.rpcUrl || RPC_URL);
const contract = contractAt(deployment.contractAddress, provider);

try {
  const result = await seedDemo({ provider, contract });
  if (result.skipped) {
    console.log('Nothing to do.');
  }
} catch (error) {
  console.error(error.shortMessage || error.message || error);
  process.exitCode = 1;
} finally {
  provider.destroy();
}
