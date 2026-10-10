import { isMemoryMode, memoryStore, pool } from '../config/database.js';

function toSection(row) {
  return { id: String(row.id), name: row.name, slug: row.slug, parentId: row.parent_id ? String(row.parent_id) : null };
}

export const sectionRepository = {
  async list() {
    if (isMemoryMode()) return [...memoryStore.sections];
    const { rows } = await pool.query('SELECT id, name, slug, parent_id FROM sections ORDER BY name');
    return rows.map(toSection);
  },
  async findById(id) {
    if (isMemoryMode()) return memoryStore.sections.find((section) => section.id === String(id)) || null;
    const { rows } = await pool.query('SELECT id, name, slug, parent_id FROM sections WHERE id=$1', [id]);
    return rows[0] ? toSection(rows[0]) : null;
  },
  async slugExists(slug, exceptId) {
    if (isMemoryMode()) return memoryStore.sections.some((section) => section.slug === slug && section.id !== String(exceptId));
    const { rowCount } = await pool.query(
      'SELECT 1 FROM sections WHERE slug=$1 AND ($2::bigint IS NULL OR id<>$2)',
      [slug, exceptId || null],
    );
    return rowCount > 0;
  },
  async save(data, id) {
    if (isMemoryMode()) {
      if (id) {
        const index = memoryStore.sections.findIndex((section) => section.id === String(id));
        if (index < 0) return null;
        memoryStore.sections[index] = { ...memoryStore.sections[index], ...data };
        return memoryStore.sections[index];
      }
      const section = { ...data, id: String(nextMemoryId(memoryStore.sections)) };
      memoryStore.sections.push(section);
      return section;
    }
    if (id) {
      const { rows } = await pool.query(
        'UPDATE sections SET name=$1, slug=$2, parent_id=$3 WHERE id=$4 RETURNING id,name,slug,parent_id',
        [data.name, data.slug, data.parentId, id],
      );
      return rows[0] ? toSection(rows[0]) : null;
    }
    const { rows } = await pool.query(
      'INSERT INTO sections (name, slug, parent_id) VALUES ($1,$2,$3) RETURNING id,name,slug,parent_id',
      [data.name, data.slug, data.parentId],
    );
    return toSection(rows[0]);
  },
  async remove(id) {
    if (isMemoryMode()) {
      const index = memoryStore.sections.findIndex((section) => section.id === String(id));
      if (index < 0) return false;
      memoryStore.sections.splice(index, 1);
      return true;
    }
    const { rowCount } = await pool.query('DELETE FROM sections WHERE id=$1', [id]);
    return rowCount > 0;
  },
  async hasChildren(id) {
    if (isMemoryMode()) return memoryStore.sections.some((section) => section.parentId === String(id));
    const { rowCount } = await pool.query('SELECT 1 FROM sections WHERE parent_id=$1 LIMIT 1', [id]);
    return rowCount > 0;
  },
  async hasPosts(id) {
    if (isMemoryMode()) return memoryStore.blogs.some((post) => post.sectionId === String(id));
    const { rowCount } = await pool.query('SELECT 1 FROM blog_posts WHERE section_id=$1 LIMIT 1', [id]);
    return rowCount > 0;
  },
};

function nextMemoryId(items) {
  return items.reduce((largest, item) => {
    const id = Number(item.id);
    return Number.isSafeInteger(id) ? Math.max(largest, id) : largest;
  }, 0) + 1;
}
