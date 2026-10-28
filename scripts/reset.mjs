import fs from 'node:fs';
import { DEPLOYMENT_PATH, relativePath } from './lib/chain.mjs';

if (fs.existsSync(DEPLOYMENT_PATH)) {
  fs.rmSync(DEPLOYMENT_PATH);
  console.log(`Removed ${relativePath(DEPLOYMENT_PATH)}.`);
} else {
  console.log('No local deployment file to remove.');
}

console.log('');
console.log('Next:');
console.log('  npm run dev -- --reset   # deploy a fresh contract and reseed');
console.log('');
console.log('If the dev server is already running, stop it first (Ctrl+C).');
