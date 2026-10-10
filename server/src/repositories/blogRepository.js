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
  async list({ admin = false, sectionId, limit, offset = 0, search = '', sort = 'publishedAt', order = 'desc' } = {}) {
    const sortColumns = {
      title: 'title',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      publishedAt: 'published_at',
    };
    const sortColumn = sortColumns[sort] || sortColumns.publishedAt;
    const sortDirection = order === 'asc' ? 'ASC' : 'DESC';
    if (isMemoryMode()) {
      const posts = memoryStore.blogs
        .filter((post) => admin || post.status === 'published')
        .filter((post) => !sectionId || post.sectionId === String(sectionId))
        .filter((post) => !search || `${post.title} ${post.content}`.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => {
          let left;
          let right;
          if (sort === 'title') {
            left = a.title.toLowerCase();
            right = b.title.toLowerCase();
          } else {
            const leftValue = sort === 'publishedAt' ? a.publishedAt || a.createdAt : a[sort] || a.createdAt;
            const rightValue = sort === 'publishedAt' ? b.publishedAt || b.createdAt : b[sort] || b.createdAt;
            left = new Date(leftValue).getTime();
            right = new Date(rightValue).getTime();
          }
          let comparison = 0;
          if (left < right) comparison = -1;
          else if (left > right) comparison = 1;
          return sortDirection === 'ASC' ? comparison : -comparison;
        });
      return {
        posts: Number.isInteger(limit) ? posts.slice(offset, offset + limit) : posts,
        total: posts.length,
      };
    }
    const conditions = [];
    const params = [];
    if (!admin) conditions.push(`status = 'published'`);
    if (sectionId) {
      params.push(sectionId);
      conditions.push(`section_id = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(title ILIKE $${params.length} OR content ILIKE $${params.length})`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await pool.query(`SELECT COUNT(*)::int AS total FROM blog_posts ${where}`, params);
    const listParams = [...params];
    let pagination = '';
    if (Number.isInteger(limit)) {
      listParams.push(limit, offset);
      pagination = `LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`;
    }
    const { rows } = await pool.query(
      `SELECT * FROM blog_posts ${where} ORDER BY ${sortColumn} ${sortDirection} NULLS LAST, id DESC ${pagination}`,
      listParams,
    );
    return { posts: rows.map(toBlog), total: countResult.rows[0].total };
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
        id: String(nextMemoryId(memoryStore.blogs)),
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
         published_at=CASE WHEN $5::varchar='published' THEN COALESCE(published_at, NOW()) ELSE NULL END,
         updated_at=NOW() WHERE id=$7 RETURNING *`,
        [data.title, data.slug, data.excerpt, data.content, data.status, data.sectionId, id],
      );
      return rows[0] ? toBlog(rows[0]) : null;
    }
    const { rows } = await pool.query(
      `INSERT INTO blog_posts (title, slug, excerpt, content, status, section_id, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,CASE WHEN $5::varchar='published' THEN NOW() ELSE NULL END) RETURNING *`,
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
  async setStatus(id, status) {
    if (isMemoryMode()) {
      const post = memoryStore.blogs.find((item) => item.id === String(id));
      if (!post) return null;
      const previouslyPublishedAt = post.publishedAt;
      post.status = status;
      post.publishedAt = status === 'published' ? previouslyPublishedAt || new Date().toISOString() : null;
      post.updatedAt = new Date().toISOString();
      return post;
    }
    const { rows } = await pool.query(
      `UPDATE blog_posts
       SET status = $1,
           published_at = CASE WHEN $1::varchar = 'published' THEN COALESCE(published_at, NOW()) ELSE NULL END,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, id],
    );
    return rows[0] ? toBlog(rows[0]) : null;
  },
};

function nextMemoryId(items) {
  return items.reduce((largest, item) => {
    const id = Number(item.id);
    return Number.isSafeInteger(id) ? Math.max(largest, id) : largest;
  }, 0) + 1;
}
