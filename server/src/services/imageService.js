import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import { uploadDirectory, ensureUploadDirectory } from '../config/uploads.js';
import { HttpError } from '../middleware/errors.js';

const extensionsByMimeType = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/gif', 'gif'],
  ['image/webp', 'webp'],
]);

export const imageService = {
  async save(file) {
    if (!file?.buffer) throw new HttpError(400, 'Choose an image to upload');
    const detectedType = await fileTypeFromBuffer(file.buffer);
    const extension = detectedType && extensionsByMimeType.get(detectedType.mime);
    if (!extension) throw new HttpError(415, 'The selected file is not a supported image');

    await ensureUploadDirectory();
    const filename = `${randomUUID()}.${extension}`;
    await writeFile(path.join(uploadDirectory, filename), file.buffer, { flag: 'wx' });
    return { url: `/uploads/${filename}` };
  },
};
