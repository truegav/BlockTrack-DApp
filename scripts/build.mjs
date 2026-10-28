import { spawn } from 'node:child_process';
import { ROOT } from './lib/chain.mjs';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: 'inherit',
      env: process.env,
    });
    child.on('error', (error) =>
      reject(new Error(`Could not run \`${command}\`: ${error.message}`))
    );
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`\`${command}\` exited with ${code}`));
    });
  });
}

try {
  console.log('[build] Compiling contracts…');
  await run('forge', ['build']);
  console.log('[build] Syncing ABI…');
  await run(process.execPath, ['scripts/sync-abi.mjs']);
  console.log('[build] Building the web app…');
  await run(npmCommand, ['--prefix', 'frontend', 'run', 'build']);
  console.log('');
  console.log('[build] Done. Static output: frontend/dist');
  console.log('[build] Ship it with any static host; the app reads /deployment.json at runtime.');
} catch (error) {
  console.error(`[build] ${error.message}`);
  process.exitCode = 1;
}
