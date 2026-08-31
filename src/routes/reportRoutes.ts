import { Router } from 'express';
import { verifyToken, isTeacherOrAdmin } from '../middleware/authMiddleware';
import { getWeeklyReport } from '../controllers/reportController';

const router = Router();

// Route cho báo cáo
router.get('/students/:id/weekly', verifyToken, isTeacherOrAdmin, getWeeklyReport);

export default router;

