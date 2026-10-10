import { HttpError } from '../middleware/errors.js';
import { isMemoryMode } from '../config/database.js';
import { sectionRepository } from '../repositories/sectionRepository.js';

const slugify = (text) => text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100);

export const sectionService = {
  async tree() {
    const sections = await sectionRepository.list();
    const nodes = new Map(sections.map((section) => [section.id, { ...section, children: [] }]));
    const roots = [];
    for (const node of nodes.values()) {
      if (node.parentId && nodes.has(node.parentId)) nodes.get(node.parentId).children.push(node);
      else roots.push(node);
    }
    return roots;
  },
  async save(input, id) {
    if (id && !isMemoryMode() && !/^\d+$/.test(String(id))) throw new HttpError(400, 'Invalid section id');
    if (input.parentId && !isMemoryMode() && !/^\d+$/.test(String(input.parentId))) {
      throw new HttpError(400, 'Invalid parent section id');
    }
    const slug = input.slug ? slugify(input.slug) : slugify(input.name);
    if (!slug) throw new HttpError(400, 'A valid section name or slug is required');
    if (input.parentId && !(await sectionRepository.findById(input.parentId))) throw new HttpError(400, 'Parent section does not exist');
    if (id && (String(id) === String(input.parentId) || await this.isDescendant(input.parentId, id))) {
      throw new HttpError(400, 'A section cannot be moved beneath itself or one of its descendants');
    }
    if (await sectionRepository.slugExists(slug, id)) throw new HttpError(409, 'That section slug is already in use');
    const section = await sectionRepository.save({ ...input, slug }, id);
    if (!section) throw new HttpError(404, 'Section not found');
    return section;
  },
  async isDescendant(candidateId, ancestorId) {
    if (!candidateId) return false;
    let current = await sectionRepository.findById(candidateId);
    while (current) {
      if (current.id === String(ancestorId)) return true;
      current = current.parentId ? await sectionRepository.findById(current.parentId) : null;
    }
    return false;
  },
  async remove(id) {
    if (!isMemoryMode() && !/^\d+$/.test(String(id))) throw new HttpError(400, 'Invalid section id');
    if (await sectionRepository.hasChildren(id)) throw new HttpError(409, 'Move or delete child sections first');
    if (await sectionRepository.hasPosts(id)) throw new HttpError(409, 'Move posts out of this section first');
    if (!(await sectionRepository.remove(id))) throw new HttpError(404, 'Section not found');
  },
};
