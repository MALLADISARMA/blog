import { Router } from 'express';
import { blogController } from '../controllers/blogController.js';
import { asyncHandler } from '../middleware/errors.js';
import { requireAdmin } from '../middleware/adminAuth.js';

const router = Router();
router.use(requireAdmin);
router.get('/', asyncHandler(blogController.adminList));
router.post('/', asyncHandler(blogController.save));
router.put('/:id', asyncHandler(blogController.save));
router.patch('/:id/publish', asyncHandler(blogController.publish));
router.patch('/:id/unpublish', asyncHandler(blogController.unpublish));
router.delete('/:id', asyncHandler(blogController.remove));

export default router;
