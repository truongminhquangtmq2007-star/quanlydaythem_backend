
import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware';
import { addDocument, updateDocument, deleteDocument, getAllDocuments } from '../controllers/documentController';

const router = Router();

router.get('/', verifyToken, getAllDocuments);
router.post('/', verifyToken, addDocument);
router.put('/:id', verifyToken, updateDocument);
router.delete('/:id', verifyToken, deleteDocument);

export default router;
