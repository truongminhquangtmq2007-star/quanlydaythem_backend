import { Router } from 'express';
import { verifyToken, isAdmin } from '../middleware/authMiddleware';
import { getStudentTopics, getClassWeakTopics } from '../controllers/analyticsController';

const router = Router();

// Routes phân tích
router.get('/students/:id/topics', verifyToken, getStudentTopics);
router.get('/classes/:id/weak-topics', verifyToken, isAdmin, getClassWeakTopics);

export default router;

