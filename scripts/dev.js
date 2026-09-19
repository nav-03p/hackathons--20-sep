const { spawn } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const isWin = process.platform === 'win32';
const npxCmd = isWin ? 'npx.cmd' : 'npx';

console.log('\x1b[36m%s\x1b[0m', '================================================');
console.log('\x1b[36m%s\x1b[0m', ' 🌐 GRIDPOINT — Starting Backend & Frontend');
console.log('\x1b[36m%s\x1b[0m', '================================================');

// 1. Start Backend on port 4000
const backend = spawn('node', ['backend/server.js'], {
  cwd: rootDir,
  stdio: 'pipe',
  env: { ...process.env, PORT: process.env.PORT || '4000' },
});

backend.stdout.on('data', (data) => {
  process.stdout.write(`\x1b[34m[backend]\x1b[0m ${data}`);
});

backend.stderr.on('data', (data) => {
  process.stderr.write(`\x1b[31m[backend error]\x1b[0m ${data}`);
});

backend.on('error', (err) => {
  console.error('\x1b[31m[backend failed to start]\x1b[0m', err.message);
});

// 2. Start Frontend on port 5173
const frontend = spawn(npxCmd, ['vite', '--host', '0.0.0.0', '--port', '5173'], {
  cwd: path.join(rootDir, 'frontend'),
  stdio: 'pipe',
  shell: true,
  env: { ...process.env },
});

frontend.stdout.on('data', (data) => {
  process.stdout.write(`\x1b[32m[frontend]\x1b[0m ${data}`);
});

frontend.stderr.on('data', (data) => {
  process.stderr.write(`\x1b[33m[frontend]\x1b[0m ${data}`);
});

frontend.on('error', (err) => {
  console.error('\x1b[31m[frontend failed to start]\x1b[0m', err.message);
});

// Cleanup on exit
function shutdown() {
  console.log('\n\x1b[33m%s\x1b[0m', 'Stopping GRIDPOINT servers...');
  try { backend.kill(); } catch {}
  try { frontend.kill(); } catch {}
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', shutdown);
