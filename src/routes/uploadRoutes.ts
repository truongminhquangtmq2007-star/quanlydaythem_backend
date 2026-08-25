import { Router } from 'express';
import { verifyToken, isTeacherOrAdmin } from '../middleware/authMiddleware';
import { uploadImage } from '../controllers/uploadController';
import multer from 'multer';

// We'll configure multer inside the controller to keep routes clean, or we can configure it here.
// But Cloudinary requires env vars. Let's configure it in a middleware or controller.
const upload = multer({ dest: 'uploads/' }); // Temporary, actually we will use memory storage or cloudinary storage directly

const router = Router();

// Endpoint upload ảnh lên Cloudinary
router.post('/image', verifyToken, isTeacherOrAdmin, uploadImage);

export default router;
