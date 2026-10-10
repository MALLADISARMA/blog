import bcrypt from 'bcrypt';
import { adminRepository } from '../repositories/adminRepository.js';
import { pool } from '../config/database.js';
import { isValidAdminPassword, isValidEmail, normalizeEmail } from '../utils/adminCredentials.js';

const email = process.env.ADMIN_EMAIL ? normalizeEmail(process.env.ADMIN_EMAIL) : '';
const password = process.env.ADMIN_PASSWORD;

try {
  if (!email || !isValidEmail(email)) {
    throw new Error('Set a valid ADMIN_EMAIL in server/.env.');
  }
  if (!password || !isValidAdminPassword(password)) {
    throw new Error('Set an ADMIN_PASSWORD of at least 12 characters in server/.env.');
  }
  const passwordHash = await bcrypt.hash(password, 12);
  if (!(await adminRepository.updatePassword(email, passwordHash))) {
    throw new Error('No administrator exists with the configured ADMIN_EMAIL.');
  }
  console.log(`Administrator password updated: ${email}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
