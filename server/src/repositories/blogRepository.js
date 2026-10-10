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

function toBlogSection(row) {
  return {
    id: String(row.id),
    title: row.title,
    content: row.content,
    parentId: row.parent_id ? String(row.parent_id) : null,
    order: row.sort_order,
  };
}

function toSectionTree(rows) {
  const nodes = new Map(rows.map((row) => [row.id, { ...row, children: [] }]));
  const roots = [];
  for (const node of nodes.values()) {
    if (node.parentId && nodes.has(node.parentId)) nodes.get(node.parentId).children.push(node);
    else roots.push(node);
  }
  const sortNodes = (items) => {
    items.sort((left, right) => left.order - right.order || Number(left.id) - Number(right.id));
    for (const item of items) sortNodes(item.children);
  };
  sortNodes(roots);
  return roots;
}

function flattenContentSections(sections, result = []) {
  for (const section of sections || []) {
    result.push(section);
    flattenContentSections(section.children, result);
  }
  return result;
}

function findSectionMatches(sections, search, parents = [], result = []) {
  const query = search.toLowerCase();
  for (const section of sections || []) {
    const path = [...parents, section.title];
    if (`${section.title} ${section.content}`.toLowerCase().includes(query)) {
      result.push({ id: String(section.id), title: section.title, path: path.join(' → ') });
    }
    findSectionMatches(section.children, search, path, result);
  }
  return result;
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
        .filter((post) => !search || `${post.title} ${post.content} ${flattenContentSections(post.sections).map((section) => `${section.title} ${section.content}`).join(' ')}`.toLowerCase().includes(search.toLowerCase()))
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
      const selected = Number.isInteger(limit) ? posts.slice(offset, offset + limit) : posts;
      return {
        posts: selected.map((post) => ({
          ...post,
          sectionMatches: search ? findSectionMatches(post.sections || [], search) : [],
        })),
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
      conditions.push(`(title ILIKE $${params.length} OR content ILIKE $${params.length} OR EXISTS (
        SELECT 1 FROM blog_sections bs WHERE bs.blog_post_id = blog_posts.id
          AND (bs.title ILIKE $${params.length} OR bs.content ILIKE $${params.length})
      ))`);
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
    const posts = rows.map(toBlog);
    if (search && posts.length) {
      const { rows: sectionRows } = await pool.query(
        `SELECT id, blog_post_id, title, content, parent_id, sort_order
         FROM blog_sections WHERE blog_post_id = ANY($1::bigint[])`,
        [posts.map((post) => post.id)],
      );
      const grouped = new Map(posts.map((post) => [post.id, []]));
      for (const row of sectionRows) {
        grouped.get(String(row.blog_post_id)).push({
          ...toBlogSection(row),
          parentId: row.parent_id ? String(row.parent_id) : null,
        });
      }
      for (const post of posts) {
        const sectionRowsForPost = grouped.get(post.id);
        const sectionsById = new Map(sectionRowsForPost.map((section) => [section.id, section]));
        for (const section of sectionRowsForPost) {
          if (!`${section.title} ${section.content}`.toLowerCase().includes(search.toLowerCase())) continue;
          const path = [section.title];
          let parent = section.parentId ? sectionsById.get(section.parentId) : null;
          while (parent) {
            path.unshift(parent.title);
            parent = parent.parentId ? sectionsById.get(parent.parentId) : null;
          }
          post.sectionMatches = post.sectionMatches || [];
          post.sectionMatches.push({ id: section.id, title: section.title, path: path.join(' → ') });
        }
      }
    }
    return { posts, total: countResult.rows[0].total };
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
    if (!rows[0]) return null;
    return { ...toBlog(rows[0]), sections: await this.listContentSections(rows[0].id) };
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
  async listContentSections(blogPostId) {
    if (isMemoryMode()) {
      const post = memoryStore.blogs.find((item) => item.id === String(blogPostId));
      return post?.sections || [];
    }
    const { rows } = await pool.query(
      `SELECT id, title, content, parent_id, sort_order
       FROM blog_sections WHERE blog_post_id = $1
       ORDER BY COALESCE(parent_id, 0), sort_order, id`,
      [blogPostId],
    );
    return toSectionTree(rows.map(toBlogSection));
  },
  async findByIdWithSections(id) {
    const post = await this.findById(id);
    if (!post) return null;
    return { ...post, sections: await this.listContentSections(id) };
  },
  async saveWithSections(data, id) {
    if (isMemoryMode()) {
      const saved = await this.save(data, id);
      if (!saved) return null;
      const oldSections = flattenContentSections(saved.sections || []);
      const oldIds = new Set(oldSections.map((section) => String(section.id)));
      let nextId = memoryStore.blogs.reduce((largest, blog) => Math.max(
        largest,
        ...flattenContentSections(blog.sections || []).map((section) => Number(section.id) || 0),
      ), 0) + 1;
      const persist = (items, parentId = null) => items.map((section, order) => {
        const sectionId = section.id && oldIds.has(String(section.id)) ? String(section.id) : String(nextId++);
        return {
          id: sectionId,
          title: section.title,
          content: section.content,
          parentId,
          order,
          children: persist(section.children || [], sectionId),
        };
      });
      saved.sections = persist(data.sections || []);
      return saved;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let blogRows;
      if (id) {
        const result = await client.query(
          `UPDATE blog_posts SET title=$1, slug=$2, excerpt=$3, content=$4, status=$5, section_id=$6,
           published_at=CASE WHEN $5::varchar='published' THEN COALESCE(published_at, NOW()) ELSE NULL END,
           updated_at=NOW() WHERE id=$7 RETURNING *`,
          [data.title, data.slug, data.excerpt, data.content, data.status, data.sectionId, id],
        );
        blogRows = result.rows;
      } else {
        const result = await client.query(
          `INSERT INTO blog_posts (title, slug, excerpt, content, status, section_id, published_at)
           VALUES ($1,$2,$3,$4,$5,$6,CASE WHEN $5::varchar='published' THEN NOW() ELSE NULL END) RETURNING *`,
          [data.title, data.slug, data.excerpt, data.content, data.status, data.sectionId],
        );
        blogRows = result.rows;
      }
      if (!blogRows[0]) {
        await client.query('ROLLBACK');
        return null;
      }
      const blog = toBlog(blogRows[0]);
      const existingResult = await client.query('SELECT id FROM blog_sections WHERE blog_post_id=$1', [blog.id]);
      const existingIds = new Set(existingResult.rows.map((row) => String(row.id)));
      const retainedIds = [];
      const persist = async (items, parentId = null) => {
        const savedItems = [];
        for (let order = 0; order < items.length; order += 1) {
          const section = items[order];
          let result;
          if (section.id && existingIds.has(String(section.id))) {
            result = await client.query(
              `UPDATE blog_sections SET title=$1, content=$2, parent_id=$3, sort_order=$4, updated_at=NOW()
               WHERE id=$5 AND blog_post_id=$6
               RETURNING id, title, content, parent_id, sort_order`,
              [section.title, section.content, parentId, order, section.id, blog.id],
            );
          } else {
            result = await client.query(
              `INSERT INTO blog_sections (blog_post_id, parent_id, title, content, sort_order)
               VALUES ($1,$2,$3,$4,$5)
               RETURNING id, title, content, parent_id, sort_order`,
              [blog.id, parentId, section.title, section.content, order],
            );
          }
          const savedSection = toBlogSection(result.rows[0]);
          retainedIds.push(savedSection.id);
          savedItems.push({ ...savedSection, children: await persist(section.children || [], savedSection.id) });
        }
        return savedItems;
      };
      const sections = await persist(data.sections || []);
      await client.query(
        'DELETE FROM blog_sections WHERE blog_post_id=$1 AND NOT (id = ANY($2::bigint[]))',
        [blog.id, retainedIds],
      );
      await client.query('COMMIT');
      return { ...blog, sections };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
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
