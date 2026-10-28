import { ContractFactory, JsonRpcProvider, Wallet } from 'ethers';
import {
  DEMO_CHAIN_ID,
  DEMO_PERSONAS,
} from '../../frontend/src/shared/personas.js';
import {
  RPC_URL,
  loadArtifact,
  waitForRpc,
  writeDeployment,
} from './chain.mjs';

/**
 * Deploy BlockTrack and write the runtime config consumed by the static frontend.
 * The demo admin is Anvil account 0 unless ADMIN_PRIVATE_KEY is supplied.
 */
export async function deployContract({
  rpcUrl = RPC_URL,
  privateKey = process.env.ADMIN_PRIVATE_KEY,
  log = console.log,
} = {}) {
  const provider = new JsonRpcProvider(rpcUrl);
  await waitForRpc(provider);

  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  const adminKey = privateKey || DEMO_PERSONAS[0].privateKey;
  const admin = new Wallet(adminKey, provider);

  const artifact = loadArtifact();
  log(`Deploying BlockTrack to ${rpcUrl} (chain ${chainId}) from ${admin.address}…`);

  const factory = new ContractFactory(artifact.abi, artifact.bytecode.object, admin);
  const contract = await factory.deploy();
  const deploymentTx = contract.deploymentTransaction();
  const receipt = await deploymentTx.wait();
  const address = await contract.getAddress();

  const deployment = {
    version: 2,
    chainId,
    rpcUrl,
    contractAddress: address,
    deploymentBlock: receipt.blockNumber,
    deployedAt: new Date().toISOString(),
    demoMode: chainId === DEMO_CHAIN_ID && !privateKey,
    admin: admin.address,
  };

  writeDeployment(deployment);
  log(`BlockTrack deployed at ${address} (block ${receipt.blockNumber}).`);
  log('Runtime config written to frontend/public/deployment.json.');

  return { deployment, provider, admin, contract, receipt };
}
