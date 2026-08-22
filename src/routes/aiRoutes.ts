import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware';
import { explainError, generateRemark } from '../controllers/aiController';

const router = Router();

// Route cho AI
router.post('/explain-error', verifyToken, explainError);
router.post('/generate-remark', verifyToken, generateRemark);

export default router;

