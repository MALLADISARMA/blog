const API_ROOT = import.meta.env.VITE_API_URL || '';
let csrfToken;

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (options.method && !['GET', 'HEAD'].includes(options.method.toUpperCase())) {
    if (!csrfToken) {
      const tokenResponse = await fetch(`${API_ROOT}/api/auth/csrf`, { credentials: 'include' });
      const tokenData = await tokenResponse.json();
      csrfToken = tokenData.csrfToken;
    }
    headers.set('X-CSRF-Token', csrfToken);
  }
  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 403) csrfToken = undefined;
    throw new Error(data.error || 'Request failed');
  }
  if (path === '/api/auth/login') csrfToken = undefined;
  return data;
}

export const api = {
  me: () => request('/api/auth/me'),
  login: (email, password) => request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  listPosts: (query = '') => request(`/api/blogs${query}`),
  getPost: (slug) => request(`/api/blogs/${encodeURIComponent(slug)}`),
  adminPosts: () => request('/api/blogs/admin/all'),
  savePost: (post) => request(post.id ? `/api/blogs/admin/${post.id}` : '/api/blogs/admin', {
    method: post.id ? 'PUT' : 'POST',
    body: JSON.stringify(post),
  }),
  deletePost: (id) => request(`/api/blogs/admin/${id}`, { method: 'DELETE' }),
  sections: () => request('/api/sections'),
  adminSections: () => request('/api/sections/admin/all'),
  saveSection: (section) => request(section.id ? `/api/sections/admin/${section.id}` : '/api/sections/admin', {
    method: section.id ? 'PUT' : 'POST',
    body: JSON.stringify(section),
  }),
  deleteSection: (id) => request(`/api/sections/admin/${id}`, { method: 'DELETE' }),
};
