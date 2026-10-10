import { Router } from 'express';
import { blogController } from '../controllers/blogController.js';
import { asyncHandler } from '../middleware/errors.js';
import { requireAdmin } from '../middleware/adminAuth.js';

const router = Router();
router.get('/', asyncHandler(blogController.list));
router.get('/section/:sectionId', asyncHandler((req, res) => blogController.list({
  ...req,
  query: { ...req.query, sectionId: req.params.sectionId },
}, res)));
router.get('/:slug', asyncHandler(blogController.getPublic));
router.get('/admin/all', requireAdmin, asyncHandler(blogController.adminList));
router.post('/admin', requireAdmin, asyncHandler(blogController.save));
router.put('/admin/:id', requireAdmin, asyncHandler(blogController.save));
router.patch('/admin/:id/publish', requireAdmin, asyncHandler(blogController.publish));
router.patch('/admin/:id/unpublish', requireAdmin, asyncHandler(blogController.unpublish));
router.delete('/admin/:id', requireAdmin, asyncHandler(blogController.remove));

export default router;
