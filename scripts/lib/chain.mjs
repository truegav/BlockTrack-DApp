import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Contract, JsonRpcProvider } from 'ethers';

const here = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(here, '..', '..');
export const FRONTEND_DIR = path.join(ROOT, 'frontend');
export const DEPLOYMENT_PATH = path.join(FRONTEND_DIR, 'public', 'deployment.json');
export const ABI_PATH = path.join(
  FRONTEND_DIR,
  'src',
  'shared',
  'abi.json'
);
export const ARTIFACT_PATH = path.join(ROOT, 'out', 'BlockTrack.sol', 'BlockTrack.json');
export const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function makeProvider(rpcUrl = RPC_URL) {
  return new JsonRpcProvider(rpcUrl);
}

export async function waitForRpc(provider, { timeoutMs = 30_000, intervalMs = 250 } = {}) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      await provider.getBlockNumber();
      return true;
    } catch (error) {
      lastError = error;
      await sleep(intervalMs);
    }
  }
  throw new Error(
    `RPC did not become ready in ${timeoutMs}ms: ${lastError?.shortMessage || lastError?.message || 'unknown error'}`
  );
}

export async function rpcIsUp(rpcUrl = RPC_URL, timeoutMs = 800) {
  const provider = new JsonRpcProvider(rpcUrl);
  try {
    await Promise.race([
      provider.getBlockNumber(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    provider.destroy();
  }
}

export function loadAbi() {
  if (!fs.existsSync(ABI_PATH)) {
    throw new Error(
      `ABI not found at ${path.relative(ROOT, ABI_PATH)}. Run \`forge build\` and \`node scripts/sync-abi.mjs\` first.`
    );
  }
  return JSON.parse(fs.readFileSync(ABI_PATH, 'utf8'));
}

export function loadArtifact() {
  if (!fs.existsSync(ARTIFACT_PATH)) {
    throw new Error(
      'Foundry artifact not found. Run `forge build` before deploying.'
    );
  }
  return JSON.parse(fs.readFileSync(ARTIFACT_PATH, 'utf8'));
}

export function readDeployment() {
  if (!fs.existsSync(DEPLOYMENT_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(DEPLOYMENT_PATH, 'utf8'));
  } catch {
    return null;
  }
}

export function writeDeployment(deployment) {
  fs.mkdirSync(path.dirname(DEPLOYMENT_PATH), { recursive: true });
  fs.writeFileSync(DEPLOYMENT_PATH, `${JSON.stringify(deployment, null, 2)}\n`);
}

export function contractAt(address, runner, abi = loadAbi()) {
  return new Contract(address, abi, runner);
}

export async function hasCode(provider, address) {
  if (!address) return false;
  try {
    const code = await provider.getCode(address);
    return Boolean(code && code !== '0x');
  } catch {
    return false;
  }
}

export async function setNextBlockTimestamp(provider, timestamp) {
  await provider.send('evm_setNextBlockTimestamp', [Math.floor(timestamp)]);
}

export async function mine(provider) {
  await provider.send('evm_mine', []);
}

export function shortAddress(address = '') {
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '';
}

export function formatAddress(address = '') {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

export function relativePath(target) {
  return path.relative(ROOT, target);
}
