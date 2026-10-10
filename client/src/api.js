import { authApi } from './api/authApi.js';
import { apiRequest } from './api/api.js';
import { blogApi } from './api/blogApi.js';
import { sectionApi } from './api/sectionApi.js';

export const api = {
  ...authApi,
  listPosts: (query = '') => apiRequest(`/api/blogs${query}`),
  getPost: blogApi.get,
  adminPosts: blogApi.adminList,
  savePost: blogApi.save,
  deletePost: blogApi.remove,
  publishPost: blogApi.publish,
  unpublishPost: blogApi.unpublish,
  sections: sectionApi.tree,
  adminSections: sectionApi.adminList,
  saveSection: sectionApi.save,
  deleteSection: sectionApi.remove,
};
