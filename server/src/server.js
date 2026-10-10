import app from './app.js';
import { pool, testDatabase, isMemoryMode } from './config/database.js';

const port = Number(process.env.PORT) || 4000;

if (!isMemoryMode()) await testDatabase();
const server = app.listen(port, () => console.log(`Blog API listening on port ${port}`));

async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
