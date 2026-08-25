import { Router } from 'express';
import { verifyToken, isTeacherOrAdmin } from '../middleware/authMiddleware';
import { getStudentTopics, getClassWeakTopics } from '../controllers/analyticsController';

const router = Router();

// Routes phân tích
router.get('/students/:id/topics', verifyToken, isTeacherOrAdmin, getStudentTopics);
router.get('/classes/:id/weak-topics', verifyToken, isTeacherOrAdmin, getClassWeakTopics);

export default router;
