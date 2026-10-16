import { spawn } from 'node:child_process';

// Be explicit: `npm start` should serve the pre-built dist/ assets, never Vite dev middleware.
const env = { ...process.env, NODE_ENV: 'production' };
const child = spawn('tsx', ['server.ts'], {
  env,
  stdio: 'inherit',
  // Windows needs shell resolution for the local tsx.cmd shim; POSIX shells are not needed.
  shell: process.platform === 'win32',
});

child.on('error', (error) => {
  console.error('Could not start the production TypeScript server. Run npm ci first.', error.message);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`Production server exited after signal ${signal}.`);
    process.exitCode = 1;
  } else {
    process.exitCode = code ?? 1;
  }
});
