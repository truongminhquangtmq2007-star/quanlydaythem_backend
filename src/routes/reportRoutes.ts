import { Router } from 'express';
import { verifyToken, isAdmin } from '../middleware/authMiddleware';
import { getWeeklyReport } from '../controllers/reportController';

const router = Router();

// Route cho báo cáo
router.get('/students/:id/weekly', verifyToken, isAdmin, getWeeklyReport);

export default router;

