import { HttpError } from './errors.js';

export function requireAdmin(req, res, next) {
  if (!req.session?.adminId) return next(new HttpError(401, 'Authentication required'));
  next();
}
