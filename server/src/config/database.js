import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

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
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
});

export async function testDatabase() {
  await pool.query('SELECT 1');
  return true;
}
