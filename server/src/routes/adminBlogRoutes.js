import { Router } from 'express';
import { blogController } from '../controllers/blogController.js';
import { asyncHandler } from '../middleware/errors.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { uploadImage } from '../middleware/uploadImage.js';
import { imageController } from '../controllers/imageController.js';

const router = Router();
router.use(requireAdmin);
router.post('/images', uploadImage, asyncHandler(imageController.upload));
router.get('/', asyncHandler(blogController.adminList));
router.get('/:id', asyncHandler(blogController.adminGet));
router.post('/', asyncHandler(blogController.save));
router.put('/:id', asyncHandler(blogController.save));
router.patch('/:id/publish', asyncHandler(blogController.publish));
router.patch('/:id/unpublish', asyncHandler(blogController.unpublish));
router.delete('/:id', asyncHandler(blogController.remove));

export default router;
