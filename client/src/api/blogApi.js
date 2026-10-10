import { apiRequest } from './api.js';

export const blogApi = {
  list: (params = {}) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
    }
    const suffix = query.size ? `?${query.toString()}` : '';
    return apiRequest(`/api/blogs${suffix}`);
  },
  get: (slug) => apiRequest(`/api/blogs/${encodeURIComponent(slug)}`),
  adminGet: (id) => apiRequest(`/api/admin/blogs/${id}`),
  adminList: (params = {}) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
    }
    const suffix = query.size ? `?${query.toString()}` : '';
    return apiRequest(`/api/admin/blogs${suffix}`);
  },
  save: (post) => apiRequest(post.id ? `/api/admin/blogs/${post.id}` : '/api/admin/blogs', {
    method: post.id ? 'PUT' : 'POST',
    body: JSON.stringify(post),
  }),
  uploadImage: (file) => {
    const formData = new FormData();
    formData.append('image', file);
    return apiRequest('/api/admin/blogs/images', { method: 'POST', body: formData });
  },
  remove: (id) => apiRequest(`/api/admin/blogs/${id}`, { method: 'DELETE' }),
  publish: (id) => apiRequest(`/api/admin/blogs/${id}/publish`, { method: 'PATCH' }),
  unpublish: (id) => apiRequest(`/api/admin/blogs/${id}/unpublish`, { method: 'PATCH' }),
};
