import { Router } from 'express';
import { verifyToken, isTeacherOrAdmin } from '../middleware/authMiddleware';
import { explainError, generateRemark, getRemark, saveRemark } from '../controllers/aiController';

const router = Router();

// Route cho AI
router.post('/explain-error', verifyToken, explainError);
router.post('/generate-remark', verifyToken, isTeacherOrAdmin, generateRemark);
router.post('/save-remark', verifyToken, isTeacherOrAdmin, saveRemark);
router.get('/remark/:studentId/:month', verifyToken, isTeacherOrAdmin, getRemark);

export default router;
