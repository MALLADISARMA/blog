import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const serverDir = path.join(root, 'server');
const clientDir = path.join(root, 'client');
const serverEntry = path.join(serverDir, 'src', 'server.js');
const viteEntry = path.join(clientDir, 'node_modules', 'vite', 'bin', 'vite.js');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [];
let stopping = false;

function run(command, args, cwd, label) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error) throw new Error(`${label} failed: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}.`);
}

function startNode(args, cwd, label) {
  const child = spawn(process.execPath, args, {
    cwd,
    stdio: 'inherit',
    windowsHide: true,
  });
  child.once('error', (error) => {
    console.error(`${label} could not start: ${error.message}`);
    stop(1);
  });
  child.once('exit', (code) => {
    if (!stopping) {
      console.error(`${label} stopped${code === 0 ? '' : ` with exit code ${code ?? 'unknown'}`}.`);
      stop(code || 1);
    }
  });
  children.push(child);
  return child;
}

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null) child.kill();
  }
  process.exitCode = exitCode;
}

async function waitFor(check, label, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await check()) return;
    } catch {
      // The service may not be ready yet.
    }
    await delay(1000);
  }
  throw new Error(`${label} did not become ready within ${Math.round(timeoutMs / 1000)} seconds.`);
}

function openBrowser(url) {
  if (process.platform === 'win32') {
    const result = spawn('cmd.exe', ['/d', '/c', 'start', '', url], {
      cwd: root,
      stdio: 'ignore',
      windowsHide: true,
    });
    result.once('error', (error) => console.warn(`Could not open a browser automatically: ${error.message}`));
    return;
  }
  const command = process.platform === 'darwin' ? 'open' : 'xdg-open';
  const result = spawn(command, [url], { stdio: 'ignore', detached: true });
  result.once('error', (error) => console.warn(`Could not open a browser automatically: ${error.message}`));
  result.unref();
}

process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());

try {
  if (!existsSync(path.join(serverDir, 'node_modules'))) {
    throw new Error('Server dependencies are missing. Run `npm run setup` once first.');
  }
  if (!existsSync(viteEntry)) {
    throw new Error('Frontend dependencies are missing. Run `npm run setup` once first.');
  }
  if (!existsSync(path.join(serverDir, '.env'))) {
    throw new Error('server/.env is missing. Copy server/.env.example to server/.env and set the admin password first.');
  }

  run('docker', ['compose', 'version'], root, 'Docker Compose check');
  console.log('Starting PostgreSQL...');
  run('docker', ['compose', 'up', '-d', 'postgres'], root, 'Docker Compose');
  await waitFor(() => {
    const result = spawnSync('docker', [
      'compose', 'exec', '-T', 'postgres', 'pg_isready', '-U', 'postgres', '-d', 'personal_blog',
    ], { cwd: root, stdio: 'ignore', windowsHide: true });
    if (result.error && result.error.code === 'ENOENT') throw new Error('Docker is not installed or not available on PATH.');
    return result.status === 0;
  }, 'PostgreSQL');

  console.log('Applying database migration...');
  run(process.execPath, ['src/db/migrate.js'], serverDir, 'Database migration');
  console.log('Ensuring administrator account exists...');
  run(process.execPath, ['src/scripts/createAdmin.js'], serverDir, 'Administrator setup');

  console.log('Starting API and Vite development server...');
  startNode(['--watch', serverEntry], serverDir, 'API server');
  startNode([viteEntry], clientDir, 'Frontend server');

  await waitFor(async () => {
    const [api, ui] = await Promise.all([
      fetch('http://localhost:4000/api/health'),
      fetch('http://localhost:5173/'),
    ]);
    return api.ok && ui.ok;
  }, 'The API and frontend');

  console.log('\nBlog is running at http://localhost:5173');
  console.log('Press Ctrl+C to stop the API and frontend. PostgreSQL remains running.\n');
  openBrowser('http://localhost:5173');
} catch (error) {
  console.error(`\nCould not start the blog: ${error.message}`);
  stop(1);
}
