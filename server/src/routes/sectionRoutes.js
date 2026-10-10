import { Router } from 'express';
import { sectionController } from '../controllers/sectionController.js';
import { blogController } from '../controllers/blogController.js';
import { asyncHandler } from '../middleware/errors.js';
import { requireAdmin } from '../middleware/adminAuth.js';

const router = Router();
router.get('/', asyncHandler(sectionController.list));
router.get('/tree', asyncHandler(sectionController.list));
router.get('/:id/blogs', asyncHandler((req, res) => blogController.list({
  ...req,
  query: { ...req.query, sectionId: req.params.id },
}, res)));
router.get('/admin/all', requireAdmin, asyncHandler(sectionController.adminList));
router.post('/admin', requireAdmin, asyncHandler(sectionController.save));
router.put('/admin/:id', requireAdmin, asyncHandler(sectionController.save));
router.delete('/admin/:id', requireAdmin, asyncHandler(sectionController.remove));

export default router;
