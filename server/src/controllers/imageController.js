import { imageService } from '../services/imageService.js';

export const imageController = {
  async upload(req, res) {
    res.status(201).json(await imageService.save(req.file));
  },
};
