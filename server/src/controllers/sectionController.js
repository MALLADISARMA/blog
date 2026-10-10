import { validate } from '../middleware/validate.js';
import { HttpError } from '../middleware/errors.js';
import { sectionRepository } from '../repositories/sectionRepository.js';
import { sectionService } from '../services/sectionService.js';

const rules = {
  name: { type: 'string', required: true, max: 100 },
  slug: { type: 'string', max: 120 },
  parentId: { type: 'string', max: 30 },
};

function parseSection(body) {
  const fields = validate(body, rules);
  return { name: fields.name, slug: fields.slug || '', parentId: fields.parentId || null };
}

export const sectionController = {
  async list(req, res) {
    res.json({ sections: await sectionService.tree() });
  },
  async adminList(req, res) {
    res.json({ sections: await sectionRepository.list() });
  },
  async save(req, res) {
    const section = await sectionService.save(parseSection(req.body), req.params.id);
    res.status(req.params.id ? 200 : 201).json({ section });
  },
  async remove(req, res) {
    if (!/^\d+$/.test(req.params.id)) throw new HttpError(400, 'Invalid section id');
    await sectionService.remove(req.params.id);
    res.sendStatus(204);
  },
};
