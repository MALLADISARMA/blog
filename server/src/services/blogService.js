import { HttpError } from '../middleware/errors.js';
import { blogRepository } from '../repositories/blogRepository.js';
import { sectionRepository } from '../repositories/sectionRepository.js';
import { sanitizeArticleContent } from './articleContent.js';

const slugify = (text) => text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100);

function sanitizeBlogSections(sections) {
  let sectionCount = 0;
  const sectionIds = new Set();
  const sanitizeTree = (items, depth = 0) => items.map((section) => {
    sectionCount += 1;
    if (sectionCount > 500 || depth > 100) {
      throw new HttpError(400, 'The blog section hierarchy is too large');
    }
    if (!section || typeof section.title !== 'string' || !section.title.trim() || section.title.length > 200) {
      throw new HttpError(400, 'Each section needs a title of 200 characters or fewer');
    }
    if (typeof section.content !== 'string' || section.content.length > 100000) {
      throw new HttpError(400, 'Section content must be 100,000 characters or fewer');
    }
    if (section.id !== undefined && section.id !== null) {
      const id = String(section.id);
      if (!/^\d+$/.test(id) || sectionIds.has(id)) {
        throw new HttpError(400, 'Invalid or duplicated blog section id');
      }
      sectionIds.add(id);
    }
    if (section.children !== undefined && !Array.isArray(section.children)) {
      throw new HttpError(400, 'Section children must be a list');
    }
    return {
      id: section.id ? String(section.id) : null,
      title: section.title.trim(),
      content: sanitizeArticleContent(section.content),
      children: sanitizeTree(section.children || [], depth + 1),
    };
  });
  return { sections: sanitizeTree(sections), sectionIds };
}

async function validateBlogSectionOwnership(blogId, sectionIds) {
  if (!blogId) return;
  const existing = await blogRepository.findByIdWithSections(blogId);
  if (!existing) throw new HttpError(404, 'Post not found');
  const existingIds = new Set();
  const collectIds = (sections) => sections.forEach((section) => {
    existingIds.add(String(section.id));
    collectIds(section.children || []);
  });
  collectIds(existing.sections);
  if ([...sectionIds].some((sectionId) => !existingIds.has(sectionId))) {
    throw new HttpError(400, 'A blog section does not belong to this blog');
  }
}

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
  async getById(id) {
    if (!/^\d+$/.test(String(id))) throw new HttpError(400, 'Invalid post id');
    const post = await blogRepository.findByIdWithSections(id);
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
    const data = {
      ...input,
      slug,
      content: sanitizeArticleContent(input.content),
    };
    if (Array.isArray(input.sections)) {
      const sanitized = sanitizeBlogSections(input.sections);
      data.sections = sanitized.sections;
      await validateBlogSectionOwnership(id, sanitized.sectionIds);
    }
    const saved = Array.isArray(data.sections)
      ? await blogRepository.saveWithSections(data, id)
      : await blogRepository.save(data, id);
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
