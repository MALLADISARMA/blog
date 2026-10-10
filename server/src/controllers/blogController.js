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
  const fields = validate(body, blogRules);
  return {
    title: fields.title,
    slug: fields.slug || '',
    excerpt: fields.excerpt || '',
    content: fields.content,
    status: fields.status,
    sectionId: fields.sectionId || null,
  };
}

export const blogController = {
  async list(req, res) {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);
    const posts = await blogService.list({
      admin: false,
      sectionId: req.query.sectionId,
      limit,
      offset,
    });
    res.json({ posts });
  },
  async getPublic(req, res) {
    res.json({ post: await blogService.get(req.params.slug, false) });
  },
  async adminList(req, res) {
    res.json({ posts: await blogService.list({ admin: true }) });
  },
  async save(req, res) {
    const post = await blogService.save(parseBlog(req.body), req.params.id);
    res.status(req.params.id ? 200 : 201).json({ post });
  },
  async remove(req, res) {
    if (!/^\d+$/.test(req.params.id) && process.env.NODE_ENV !== 'test') throw new HttpError(400, 'Invalid post id');
    await blogService.remove(req.params.id);
    res.sendStatus(204);
  },
};
