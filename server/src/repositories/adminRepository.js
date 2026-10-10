import { isMemoryMode, memoryStore, pool } from '../config/database.js';

export const adminRepository = {
  async findByEmail(email) {
    if (isMemoryMode()) return memoryStore.admins.find((admin) => admin.email === email) || null;
    const { rows } = await pool.query('SELECT id, email, password_hash FROM admins WHERE email = $1', [email]);
    return rows[0] || null;
  },
  async findById(id) {
    if (isMemoryMode()) return memoryStore.admins.find((admin) => admin.id === id) || null;
    const { rows } = await pool.query('SELECT id, email FROM admins WHERE id = $1', [id]);
    return rows[0] || null;
  },
  async create(email, passwordHash) {
    if (isMemoryMode()) {
      if (memoryStore.admins.length) throw new Error('Only one administrator account is supported.');
      const admin = { id: String(memoryStore.admins.length + 1), email, password_hash: passwordHash };
      memoryStore.admins.push(admin);
      return admin;
    }
    const { rows } = await pool.query(
      'INSERT INTO admins (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, passwordHash],
    );
    return rows[0];
  },
};
