import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { pool } from '../config/database.js';

const migrationPath = fileURLToPath(new URL('./migrations/001-initial.sql', import.meta.url));

try {
  const migration = await readFile(migrationPath, 'utf8');
  await pool.query(migration);
  console.log('Database migration completed.');
} catch (error) {
  console.error('Database migration failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
