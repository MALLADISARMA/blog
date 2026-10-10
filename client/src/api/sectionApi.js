import { apiRequest } from './api.js';

export const sectionApi = {
  tree: () => apiRequest('/api/sections/tree'),
  posts: (id, params = {}) => {
    const query = new URLSearchParams(params);
    const suffix = query.size ? `?${query.toString()}` : '';
    return apiRequest(`/api/sections/${id}/blogs${suffix}`);
  },
  adminList: () => apiRequest('/api/sections/admin/all'),
  save: (section) => apiRequest(section.id ? `/api/admin/sections/${section.id}` : '/api/admin/sections', {
    method: section.id ? 'PUT' : 'POST',
    body: JSON.stringify(section),
  }),
  remove: (id) => apiRequest(`/api/admin/sections/${id}`, { method: 'DELETE' }),
};
