import { authService } from '../services/authService.js';
import { adminRepository } from '../repositories/adminRepository.js';
import { isValidEmail } from '../utils/adminCredentials.js';

export const authController = {
  csrf(req, res) {
    res.set('Cache-Control', 'no-store');
    res.json({ csrfToken: req.csrfToken() });
  },
  async login(req, res) {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const normalizedEmail = email.trim();
    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ error: 'Email is invalid' });
    }
    const admin = await authService.authenticate(normalizedEmail, password);
    await new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
    req.session.adminId = admin.id;
    await new Promise((resolve, reject) => {
      req.session.save((error) => error ? reject(error) : resolve());
    });
    res.json({ admin });
  },
  async me(req, res) {
    if (!req.session?.adminId) return res.json({ admin: null });
    const admin = await adminRepository.findById(req.session.adminId);
    if (!admin) {
      await new Promise((resolve, reject) => req.session.destroy((error) => error ? reject(error) : resolve()));
      res.clearCookie('blog.sid', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
      return res.json({ admin: null });
    }
    res.json({ admin: { id: String(admin.id), email: admin.email } });
  },
  logout(req, res) {
    const clearSessionCookie = () => res.clearCookie('blog.sid', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    if (!req.session) {
      clearSessionCookie();
      return res.sendStatus(204);
    }
    req.session.destroy((error) => {
      if (error) return res.status(500).json({ error: 'Could not end session' });
      clearSessionCookie();
      res.sendStatus(204);
    });
  },
};
