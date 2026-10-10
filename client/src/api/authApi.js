import { apiRequest } from './api.js';

export const authApi = {
  me: () => apiRequest('/api/auth/me'),
  csrf: () => apiRequest('/api/auth/csrf'),
  login: (email, password) => apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }),
  logout: () => apiRequest('/api/auth/logout', { method: 'POST' }),
};
