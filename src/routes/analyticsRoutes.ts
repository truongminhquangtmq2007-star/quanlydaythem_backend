import { Router } from 'express';
import { verifyToken, isTeacherOrAdmin } from '../middleware/authMiddleware';
import { getStudentTopics, getClassWeakTopics } from '../controllers/analyticsController';

const router = Router();

// Routes phân tích: Học sinh được xem chuyên đề của chính mình; Giáo viên/Admin xem theo thẩm quyền
router.get('/students/:id/topics', verifyToken, getStudentTopics);
router.get('/classes/:id/weak-topics', verifyToken, isTeacherOrAdmin, getClassWeakTopics);

export default router;
