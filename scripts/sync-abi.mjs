import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const artifactPath = path.join(root, 'out', 'BlockTrack.sol', 'BlockTrack.json');
const targetPath = path.join(root, 'frontend', 'src', 'shared', 'abi.json');

if (!fs.existsSync(artifactPath)) {
  console.error(
    'Missing Foundry artifact. Run `forge build` first (or `npm run dev`, which builds automatically).'
  );
  process.exit(1);
}

const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
fs.writeFileSync(targetPath, `${JSON.stringify(artifact.abi, null, 2)}\n`);
console.log(`ABI synced → ${path.relative(root, targetPath)} (${artifact.abi.length} entries)`);
