import { deployContract } from './lib/deploy.mjs';
import { RPC_URL } from './lib/chain.mjs';

try {
  const { deployment } = await deployContract({ rpcUrl: RPC_URL });
  console.log('');
  console.log('Deployment');
  console.log(`  network   ${deployment.chainId}`);
  console.log(`  contract  ${deployment.contractAddress}`);
  console.log(`  block     ${deployment.deploymentBlock}`);
  console.log(`  admin     ${deployment.admin}`);
  console.log(`  demo      ${deployment.demoMode ? 'yes' : 'no'}`);
  console.log('');
  console.log('Next: npm run seed');
} catch (error) {
  console.error(error.shortMessage || error.message || error);
  process.exitCode = 1;
}
