import { Router } from 'express';
import { verifyToken, isTeacherOrAdmin } from '../middleware/authMiddleware';
import { uploadImage, uploadDocument } from '../controllers/uploadController';

const router = Router();

router.post('/image', verifyToken, isTeacherOrAdmin, uploadImage);
router.post('/document', verifyToken, isTeacherOrAdmin, uploadDocument);

export default router;
