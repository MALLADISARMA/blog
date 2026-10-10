import { isMemoryMode, memoryStore, pool } from '../config/database.js';

function toBlog(row) {
  return {
    id: String(row.id),
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    content: row.content,
    status: row.status,
    sectionId: row.section_id ? String(row.section_id) : null,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const blogRepository = {
  async list({ admin = false, sectionId, limit = 50, offset = 0 } = {}) {
    if (isMemoryMode()) {
      return memoryStore.blogs
        .filter((post) => admin || post.status === 'published')
        .filter((post) => !sectionId || post.sectionId === String(sectionId))
        .sort((a, b) => new Date(b.publishedAt || b.createdAt) - new Date(a.publishedAt || a.createdAt))
        .slice(offset, offset + limit);
    }
    const conditions = [];
    const params = [];
    if (!admin) conditions.push(`status = 'published'`);
    if (sectionId) {
      params.push(sectionId);
      conditions.push(`section_id = $${params.length}`);
    }
    params.push(limit, offset);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT * FROM blog_posts ${where} ORDER BY COALESCE(published_at, created_at) DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return rows.map(toBlog);
  },
  async findBySlug(slug, { admin = false } = {}) {
    if (isMemoryMode()) {
      const post = memoryStore.blogs.find((item) => item.slug === slug);
      return post && (admin || post.status === 'published') ? post : null;
    }
    const { rows } = await pool.query(
      `SELECT * FROM blog_posts WHERE slug = $1${admin ? '' : " AND status = 'published'"}`,
      [slug],
    );
    return rows[0] ? toBlog(rows[0]) : null;
  },
  async findById(id) {
    if (isMemoryMode()) return memoryStore.blogs.find((post) => post.id === String(id)) || null;
    const { rows } = await pool.query('SELECT * FROM blog_posts WHERE id = $1', [id]);
    return rows[0] ? toBlog(rows[0]) : null;
  },
  async slugExists(slug, exceptId) {
    if (isMemoryMode()) return memoryStore.blogs.some((post) => post.slug === slug && post.id !== String(exceptId));
    const { rowCount } = await pool.query(
      'SELECT 1 FROM blog_posts WHERE slug = $1 AND ($2::bigint IS NULL OR id <> $2)',
      [slug, exceptId || null],
    );
    return rowCount > 0;
  },
  async save(data, id) {
    const publishedAt = data.status === 'published' ? new Date().toISOString() : null;
    if (isMemoryMode()) {
      const now = new Date().toISOString();
      if (id) {
        const index = memoryStore.blogs.findIndex((post) => post.id === String(id));
        if (index < 0) return null;
        const previous = memoryStore.blogs[index];
        memoryStore.blogs[index] = {
          ...previous,
          ...data,
          id: previous.id,
          publishedAt: data.status === 'published' ? previous.publishedAt || publishedAt : null,
          updatedAt: now,
        };
        return memoryStore.blogs[index];
      }
      const post = {
        ...data,
        id: String(Date.now() + Math.random()),
        publishedAt,
        createdAt: now,
        updatedAt: now,
      };
      memoryStore.blogs.push(post);
      return post;
    }
    if (id) {
      const { rows } = await pool.query(
        `UPDATE blog_posts SET title=$1, slug=$2, excerpt=$3, content=$4, status=$5, section_id=$6,
         published_at=CASE WHEN $5='published' THEN COALESCE(published_at, NOW()) ELSE NULL END,
         updated_at=NOW() WHERE id=$7 RETURNING *`,
        [data.title, data.slug, data.excerpt, data.content, data.status, data.sectionId, id],
      );
      return rows[0] ? toBlog(rows[0]) : null;
    }
    const { rows } = await pool.query(
      `INSERT INTO blog_posts (title, slug, excerpt, content, status, section_id, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,CASE WHEN $5='published' THEN NOW() ELSE NULL END) RETURNING *`,
      [data.title, data.slug, data.excerpt, data.content, data.status, data.sectionId],
    );
    return toBlog(rows[0]);
  },
  async remove(id) {
    if (isMemoryMode()) {
      const index = memoryStore.blogs.findIndex((post) => post.id === String(id));
      if (index < 0) return false;
      memoryStore.blogs.splice(index, 1);
      return true;
    }
    const { rowCount } = await pool.query('DELETE FROM blog_posts WHERE id = $1', [id]);
    return rowCount > 0;
  },
};
