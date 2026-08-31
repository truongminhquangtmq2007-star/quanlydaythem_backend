import { Router } from 'express';
import { verifyToken, isTeacherOrAdmin } from '../middleware/authMiddleware';
import { explainError, generateRemark, getRemark, saveRemark } from '../controllers/aiController';
import { getLatestInsight, generateInsight } from '../controllers/insightController';

const router = Router();

// Route cho Student AI: Hỏi đáp & Giải thích câu hỏi
router.post('/explain-error', verifyToken, explainError);

// Route cho Teacher AI: Nhận xét học phí, đánh giá và phân tích cá nhân hóa (Bảo vệ nghiêm ngặt)
router.post('/generate-remark', verifyToken, isTeacherOrAdmin, generateRemark);
router.post('/save-remark', verifyToken, isTeacherOrAdmin, saveRemark);
router.get('/remark/:studentId/:month', verifyToken, isTeacherOrAdmin, getRemark);
router.get('/insight/:studentId', verifyToken, isTeacherOrAdmin, getLatestInsight);
router.post('/insight/generate', verifyToken, isTeacherOrAdmin, generateInsight);

export default router;
