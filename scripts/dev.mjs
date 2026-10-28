import { spawn } from 'node:child_process';
import path from 'node:path';
import {
  ROOT,
  RPC_URL,
  contractAt,
  hasCode,
  makeProvider,
  readDeployment,
  rpcIsUp,
  waitForRpc,
} from './lib/chain.mjs';
import { deployContract } from './lib/deploy.mjs';
import { seedDemo } from './lib/seed.mjs';

const args = new Set(process.argv.slice(2));
const forceReset = args.has('--reset') || args.has('--fresh');
const rpcUrl = process.env.RPC_URL || RPC_URL;
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

let anvilChild = null;
let viteChild = null;
let appProvider = null;
let shuttingDown = false;

function log(message) {
  console.log(`[blocktrack] ${message}`);
}

function run(command, commandArgs, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: ROOT,
      stdio: 'inherit',
      env: process.env,
      ...options,
    });
    child.on('error', (error) => {
      reject(
        new Error(
          `Could not run \`${command}\`: ${error.message}. Is it installed and on PATH?`
        )
      );
    });
    child.on('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`\`${command} ${commandArgs.join(' ')}\` exited with ${code ?? signal}`));
    });
  });
}

function stopChildren(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  log('Shutting down…');
  if (viteChild && !viteChild.killed) viteChild.kill('SIGINT');
  if (anvilChild && !anvilChild.killed) anvilChild.kill('SIGINT');
  if (appProvider) appProvider.destroy();
  setTimeout(() => process.exit(exitCode), 250);
}

process.on('SIGINT', () => stopChildren(0));
process.on('SIGTERM', () => stopChildren(0));

try {
  if (!(await rpcIsUp(rpcUrl))) {
    const backdatedGenesis = Math.floor(Date.now() / 1000) - 45 * 86_400;
    log(`Starting Anvil on ${rpcUrl} (genesis backdated 45 days for a realistic demo timeline)…`);
    anvilChild = spawn(
      'anvil',
      [
        '--host',
        '127.0.0.1',
        '--port',
        '8545',
        '--chain-id',
        '31337',
        '--timestamp',
        String(backdatedGenesis),
        '--silent',
      ],
      { cwd: ROOT, stdio: 'inherit', env: process.env }
    );
    anvilChild.on('error', (error) => {
      console.error(`Failed to start anvil: ${error.message}`);
      stopChildren(1);
    });
    anvilChild.on('exit', (code) => {
      if (!shuttingDown) {
        log(`Anvil exited (${code ?? 'signal'}).`);
        stopChildren(code ?? 1);
      }
    });
    const probe = makeProvider(rpcUrl);
    await waitForRpc(probe);
    probe.destroy();
  } else {
    log(`Using the existing Anvil/RPC at ${rpcUrl}.`);
  }

  log('Building contracts…');
  await run('forge', ['build']);

  log('Syncing contract ABI…');
  await run(process.execPath, ['scripts/sync-abi.mjs']);

  const probe = makeProvider(rpcUrl);
  const network = await probe.getNetwork();
  const chainId = Number(network.chainId);
  const existing = readDeployment();

  let needsDeploy = forceReset || !existing?.contractAddress;
  if (!needsDeploy) {
    const sameChain = existing.chainId === chainId;
    const codeThere = await hasCode(probe, existing.contractAddress);
    if (!sameChain || !codeThere) {
      log(
        !sameChain
          ? `Deployment is for chain ${existing.chainId}, current chain is ${chainId}. Redeploying.`
          : 'Deployment address has no code on this chain. Redeploying.'
      );
      needsDeploy = true;
    }
  }
  probe.destroy();

  let deployment = existing;
  if (needsDeploy) {
    log(forceReset ? 'Fresh deployment requested.' : 'Deploying BlockTrack…');
    const result = await deployContract({ rpcUrl });
    deployment = result.deployment;
  } else {
    log(`Reusing contract at ${existing.contractAddress} (block ${existing.deploymentBlock}).`);
  }

  appProvider = makeProvider(rpcUrl);
  const contract = contractAt(deployment.contractAddress, appProvider);
  log('Seeding demo data (encrypted on-chain)…');
  await seedDemo({ provider: appProvider, contract });

  log('Starting the web app…');
  viteChild = spawn(
    npmCommand,
    [
      '--prefix',
      'frontend',
      'run',
      'dev',
      '--',
      '--host',
      '127.0.0.1',
      '--port',
      '5173',
      '--strictPort',
    ],
    { cwd: ROOT, stdio: 'inherit', env: process.env }
  );
  viteChild.on('error', (error) => {
    console.error(`Failed to start Vite: ${error.message}`);
    stopChildren(1);
  });
  viteChild.on('exit', (code) => {
    if (!shuttingDown) {
      log(`Vite exited (${code ?? 'signal'}).`);
      stopChildren(code ?? 0);
    }
  });

  console.log('');
  console.log('  BlockTrack is running');
  console.log('  ─────────────────────────────────────────────');
  console.log('  App            http://127.0.0.1:5173');
  console.log('  Public track   http://127.0.0.1:5173/track');
  console.log(`  Chain          ${rpcUrl} (chain ${deployment.chainId})`);
  console.log(`  Contract       ${deployment.contractAddress}`);
  console.log(`  Deployment     block ${deployment.deploymentBlock}`);
  console.log('');
  console.log('  Demo accounts  no MetaMask needed');
  console.log('    Maya Sharma    admin      operations');
  console.log('    Arjun Kapoor   courier    Bengaluru');
  console.log('    Priya Nair     courier    Mumbai');
  console.log('    Rohan Mehta    customer   Bengaluru');
  console.log('    Ananya Iyer    customer   Mumbai');
  console.log('    Kabir Shah     customer   Delhi');
  console.log('');
  console.log('  Stop with Ctrl+C');
  console.log('');
} catch (error) {
  console.error('');
  console.error(`[blocktrack] ${error.shortMessage || error.message || error}`);
  if (String(error.message).includes('Read-only file system')) {
    console.error(
      'Hint: Foundry is trying to write to your home directory. Set HOME and SVM_HOME to writable paths, or install solc first.'
    );
  }
  stopChildren(1);
}
