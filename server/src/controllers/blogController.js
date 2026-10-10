import { HttpError } from '../middleware/errors.js';
import { blogService } from '../services/blogService.js';
import { validate } from '../middleware/validate.js';

const blogRules = {
  title: { type: 'string', required: true, max: 200 },
  slug: { type: 'string', max: 120 },
  excerpt: { type: 'string', max: 500 },
  content: { type: 'string', required: true, max: 100000 },
  status: { type: 'string', required: true, max: 20 },
  sectionId: { type: 'string', max: 30 },
};

function parseBlog(body) {
  if (body.sections !== undefined && !Array.isArray(body.sections)) {
    throw new HttpError(400, 'Sections must be a list');
  }
  const fields = validate(body, blogRules);
  return {
    title: fields.title,
    slug: fields.slug || '',
    excerpt: fields.excerpt || '',
    content: fields.content,
    status: fields.status,
    sectionId: fields.sectionId || null,
    ...(body.sections === undefined ? {} : { sections: body.sections }),
  };
}

export const blogController = {
  async list(req, res) {
    const page = parseQueryInteger(req.query.page, 'page', 1, 1, 1000000);
    const limit = parseQueryInteger(req.query.limit, 'limit', 10, 1, 100);
    const offset = req.query.offset === undefined
      ? (page - 1) * limit
      : parseQueryInteger(req.query.offset, 'offset', 0, 0, 100000000);
    const result = await blogService.list({
      admin: false,
      sectionId: req.query.sectionId,
      search: parseSearch(req.query.search ?? req.query.q),
      sort: parseSort(req.query.sort),
      order: parseOrder(req.query.order),
      limit,
      offset,
    });
    res.json({
      posts: result.posts,
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    });
  },
  async getPublic(req, res) {
    res.json({ post: await blogService.get(req.params.slug, false) });
  },
  async adminGet(req, res) {
    res.json({ post: await blogService.getById(req.params.id) });
  },
  async adminList(req, res) {
    const result = await blogService.list({
      admin: true,
      search: parseSearch(req.query.search ?? req.query.q),
      sectionId: req.query.sectionId,
      sort: parseSort(req.query.sort, 'createdAt'),
      order: parseOrder(req.query.order),
    });
    res.json({ posts: result.posts });
  },
  async save(req, res) {
    const post = await blogService.save(parseBlog(req.body), req.params.id);
    res.status(req.params.id ? 200 : 201).json({ post });
  },
  async remove(req, res) {
    await blogService.remove(req.params.id);
    res.sendStatus(204);
  },
  async publish(req, res) {
    res.json({ post: await blogService.setStatus(req.params.id, 'published') });
  },
  async unpublish(req, res) {
    res.json({ post: await blogService.setStatus(req.params.id, 'draft') });
  },
};

function parseQueryInteger(value, name, fallback, min, max) {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(String(value))) throw new HttpError(400, `Invalid ${name}`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) throw new HttpError(400, `Invalid ${name}`);
  return number;
}

function parseSearch(value) {
  if (value === undefined) return '';
  if (typeof value !== 'string' || value.length > 200) throw new HttpError(400, 'Invalid search query');
  return value.trim();
}

function parseSort(value, fallback = 'publishedAt') {
  const allowed = ['publishedAt', 'createdAt', 'updatedAt', 'title'];
  if (value === undefined) return fallback;
  if (!allowed.includes(value)) throw new HttpError(400, 'Invalid sort field');
  return value;
}

function parseOrder(value) {
  if (value === undefined) return 'desc';
  if (!['asc', 'desc'].includes(value)) throw new HttpError(400, 'Invalid sort order');
  return value;
}
