import bcrypt from 'bcrypt';
import { HttpError } from '../middleware/errors.js';
import { adminRepository } from '../repositories/adminRepository.js';

export const authService = {
  async authenticate(email, password) {
    const admin = await adminRepository.findByEmail(email.toLowerCase());
    if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
      throw new HttpError(401, 'Invalid email or password');
    }
    return { id: String(admin.id), email: admin.email };
  },
};
