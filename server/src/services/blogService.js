import { HttpError } from '../middleware/errors.js';
import { blogRepository } from '../repositories/blogRepository.js';
import { sectionRepository } from '../repositories/sectionRepository.js';

const slugify = (text) => text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100);

export const blogService = {
  list(options = {}) {
    if (options.sectionId && !/^\d+$/.test(String(options.sectionId))) {
      throw new HttpError(400, 'Invalid section id');
    }
    return blogRepository.list(options);
  },
  async get(slug, admin) {
    if (typeof slug !== 'string' || slug.length > 120 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new HttpError(400, 'Invalid post slug');
    }
    const post = await blogRepository.findBySlug(slug, { admin });
    if (!post) throw new HttpError(404, 'Post not found');
    return post;
  },
  async save(input, id) {
    if (id && !/^\d+$/.test(String(id))) throw new HttpError(400, 'Invalid post id');
    if (input.sectionId && !/^\d+$/.test(String(input.sectionId))) {
      throw new HttpError(400, 'Invalid section id');
    }
    const slug = input.slug ? slugify(input.slug) : slugify(input.title);
    if (!slug) throw new HttpError(400, 'A valid title or slug is required');
    if (!['draft', 'published'].includes(input.status)) throw new HttpError(400, 'Status must be draft or published');
    if (await blogRepository.slugExists(slug, id)) throw new HttpError(409, 'That slug is already in use');
    if (input.sectionId && !(await sectionRepository.findById(input.sectionId))) throw new HttpError(400, 'Section does not exist');
    const saved = await blogRepository.save({ ...input, slug }, id);
    if (!saved) throw new HttpError(404, 'Post not found');
    return saved;
  },
  async remove(id) {
    if (!/^\d+$/.test(String(id))) throw new HttpError(400, 'Invalid post id');
    if (!(await blogRepository.remove(id))) throw new HttpError(404, 'Post not found');
  },
  async setStatus(id, status) {
    if (!/^\d+$/.test(String(id))) throw new HttpError(400, 'Invalid post id');
    if (!['draft', 'published'].includes(status)) throw new HttpError(400, 'Invalid post status');
    const post = await blogRepository.setStatus(id, status);
    if (!post) throw new HttpError(404, 'Post not found');
    return post;
  },
};
