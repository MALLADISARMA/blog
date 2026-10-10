import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const memoryStore = {
  admins: [],
  sections: [],
  blogs: [],
};

export function isMemoryMode() {
  return process.env.USE_MEMORY_DB === 'true' || process.env.NODE_ENV === 'test';
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/personal_blog',
  max: 10,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function testDatabase() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
