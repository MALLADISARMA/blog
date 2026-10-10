import multer from 'multer';
import { HttpError } from './errors.js';

const acceptedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

const receiveImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    if (!acceptedMimeTypes.has(file.mimetype)) {
      callback(new HttpError(415, 'Upload a JPEG, PNG, GIF, or WebP image'));
      return;
    }
    callback(null, true);
  },
}).single('image');

export function uploadImage(req, res, next) {
  receiveImage(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return next(new HttpError(413, 'Image must be 5 MB or smaller'));
    }
    if (error instanceof multer.MulterError) {
      return next(new HttpError(400, 'Invalid image upload'));
    }
    next(error);
  });
}
