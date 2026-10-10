import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { pool } from '../config/database.js';

const migrationPaths = [
  new URL('./migrations/001-initial.sql', import.meta.url),
  new URL('./migrations/002-blog-sections.sql', import.meta.url),
];

try {
  for (const migrationUrl of migrationPaths) {
    const migration = await readFile(fileURLToPath(migrationUrl), 'utf8');
    await pool.query(migration);
  }
  console.log('Database migration completed.');
} catch (error) {
  console.error('Database migration failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
