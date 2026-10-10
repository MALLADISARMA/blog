import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { adminRepository } from '../repositories/adminRepository.js';
import { pool } from '../config/database.js';

try {
  if (await adminRepository.exists()) {
    console.log('Administrator account is already provisioned.');
  } else {
    const scriptPath = fileURLToPath(new URL('./createAdmin.js', import.meta.url));
    const result = spawnSync(process.execPath, [scriptPath], { stdio: 'inherit', env: process.env });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exitCode = result.status || 1;
  }
} catch (error) {
  console.error(`Administrator setup failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
