import dotenv from 'dotenv';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

const serverDirectory = fileURLToPath(new URL('../../', import.meta.url));
export const uploadDirectory = path.resolve(
  serverDirectory,
  process.env.UPLOAD_DIR || 'uploads',
);

export async function ensureUploadDirectory() {
  await mkdir(uploadDirectory, { recursive: true });
}
