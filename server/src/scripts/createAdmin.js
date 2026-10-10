import bcrypt from 'bcrypt';
import { adminRepository } from '../repositories/adminRepository.js';
import { pool, isMemoryMode } from '../config/database.js';

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

try {
  if (!email || !password || password.length < 12) {
    throw new Error('Set ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters in server/.env.');
  }
  if (!isMemoryMode() && process.env.USE_MEMORY_DB !== 'true') {
    await pool.query('SELECT 1 FROM admins LIMIT 1');
  }
  if (await adminRepository.findByEmail(email)) {
    console.log(`Administrator already exists: ${email}`);
    process.exitCode = 0;
  } else {
    const hash = await bcrypt.hash(password, 12);
    await adminRepository.create(email, hash);
    console.log(`Administrator created: ${email}`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
