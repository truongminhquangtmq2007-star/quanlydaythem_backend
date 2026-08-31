
import { Router } from 'express';
import { verifyToken, isTeacherOrAdmin } from '../middleware/authMiddleware';
import { addDocument, updateDocument, deleteDocument, getAllDocuments } from '../controllers/documentController';

const router = Router();

router.get('/', verifyToken, isTeacherOrAdmin, getAllDocuments);
router.post('/', verifyToken, isTeacherOrAdmin, addDocument);
router.put('/:id', verifyToken, isTeacherOrAdmin, updateDocument);
router.delete('/:id', verifyToken, isTeacherOrAdmin, deleteDocument);

export default router;
