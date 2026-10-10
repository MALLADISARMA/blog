import { Router } from 'express';
import { sectionController } from '../controllers/sectionController.js';
import { asyncHandler } from '../middleware/errors.js';
import { requireAdmin } from '../middleware/adminAuth.js';

const router = Router();
router.use(requireAdmin);
router.post('/', asyncHandler(sectionController.save));
router.put('/:id', asyncHandler(sectionController.save));
router.delete('/:id', asyncHandler(sectionController.remove));

export default router;
