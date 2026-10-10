import { authService } from '../services/authService.js';
import { adminRepository } from '../repositories/adminRepository.js';

export const authController = {
  csrf(req, res) {
    res.json({ csrfToken: req.csrfToken() });
  },
  async login(req, res) {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const admin = await authService.authenticate(email.trim(), password);
    await new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
    req.session.adminId = admin.id;
    res.json({ admin });
  },
  async me(req, res) {
    if (!req.session?.adminId) return res.json({ admin: null });
    const admin = await adminRepository.findById(req.session.adminId);
    if (!admin) {
      req.session.destroy(() => {});
      return res.json({ admin: null });
    }
    res.json({ admin: { id: String(admin.id), email: admin.email } });
  },
  logout(req, res) {
    if (!req.session) return res.sendStatus(204);
    req.session.destroy((error) => {
      if (error) return res.status(500).json({ error: 'Could not end session' });
      res.clearCookie('blog.sid', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
      res.sendStatus(204);
    });
  },
};
