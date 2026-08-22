import { Router } from 'express';
import { uploadCloud as upload } from '../middleware/uploadMiddleware';
import { verifyToken, isAdmin } from '../middleware/authMiddleware';
import { uploadDocument, deleteDocument, getAllDocuments } from '../controllers/documentController';

const router = Router();

router.get('/', verifyToken, getAllDocuments);
router.post('/upload', verifyToken, upload.single('file'), uploadDocument);
router.post('/', verifyToken, upload.single('file'), uploadDocument);
router.delete('/:id', verifyToken, deleteDocument);

export default router;