/**
 * Convert Foundry's BlockTrack artifact into the contract definition that the
 * Caliper Ethereum adapter expects: { name, abi, bytecode, gas }.
 *
 * Run after `forge build` / `npm run dev`. The generated file is committed so
 * the benchmark can run without recompiling, but this script is the source of
 * truth whenever the contract changes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/chain.mjs';

const artifactPath = path.join(ROOT, 'out', 'BlockTrack.sol', 'BlockTrack.json');
const destination = path.join(
  ROOT,
  'benchmarks',
  'caliper',
  'contracts',
  'BlockTrack.json'
);

if (!fs.existsSync(artifactPath)) {
  console.error(
    `[caliper] Missing ${path.relative(ROOT, artifactPath)}. Run \`forge build\` (or \`npm run dev\`) first.`
  );
  process.exit(1);
}

const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
const bytecode = artifact.bytecode?.object ?? artifact.bytecode;
if (!bytecode) {
  console.error('[caliper] The Foundry artifact has no bytecode.');
  process.exit(1);
}

const contract = {
  name: 'BlockTrack',
  abi: artifact.abi,
  bytecode: bytecode.startsWith('0x') ? bytecode : `0x${bytecode}`,
  gas: 7_000_000,
};

fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, `${JSON.stringify(contract, null, 2)}\n`);
console.log(
  `[caliper] Wrote ${path.relative(ROOT, destination)} (${artifact.abi.length} ABI entries, ${Math.round(contract.bytecode.length / 2)} bytes bytecode).`
);
