import { isMemoryMode, memoryStore, pool } from '../config/database.js';
import { normalizeEmail } from '../utils/adminCredentials.js';

export const adminRepository = {
  async findByEmail(email) {
    const normalizedEmail = normalizeEmail(email);
    if (isMemoryMode()) {
      return memoryStore.admins.find((admin) => normalizeEmail(admin.email) === normalizedEmail) || null;
    }
    const { rows } = await pool.query(
      'SELECT id, email, password_hash FROM admins WHERE LOWER(email) = $1',
      [normalizedEmail],
    );
    return rows[0] || null;
  },
  async findById(id) {
    if (isMemoryMode()) return memoryStore.admins.find((admin) => admin.id === id) || null;
    const { rows } = await pool.query('SELECT id, email FROM admins WHERE id = $1', [id]);
    return rows[0] || null;
  },
  async exists() {
    if (isMemoryMode()) return memoryStore.admins.length > 0;
    const { rowCount } = await pool.query('SELECT 1 FROM admins LIMIT 1');
    return rowCount > 0;
  },
  async create(email, passwordHash) {
    const normalizedEmail = normalizeEmail(email);
    if (isMemoryMode()) {
      if (memoryStore.admins.length) throw new Error('Only one administrator account is supported.');
      const admin = { id: String(memoryStore.admins.length + 1), email: normalizedEmail, password_hash: passwordHash };
      memoryStore.admins.push(admin);
      return admin;
    }
    const { rows } = await pool.query(
      'INSERT INTO admins (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [normalizedEmail, passwordHash],
    );
    return rows[0];
  },
  async updatePassword(email, passwordHash) {
    const normalizedEmail = normalizeEmail(email);
    if (isMemoryMode()) {
      const admin = memoryStore.admins.find((item) => normalizeEmail(item.email) === normalizedEmail);
      if (!admin) return false;
      admin.password_hash = passwordHash;
      return true;
    }
    const { rowCount } = await pool.query(
      'UPDATE admins SET password_hash = $1 WHERE LOWER(email) = $2',
      [passwordHash, normalizedEmail],
    );
    return rowCount > 0;
  },
};
