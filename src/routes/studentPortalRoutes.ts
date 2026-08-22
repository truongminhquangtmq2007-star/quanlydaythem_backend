import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware';
import { getDashboard, getSchedule, getDocuments } from '../controllers/studentPortalController';

const router = Router();

router.get('/dashboard', verifyToken, getDashboard);
router.get('/schedule', verifyToken, getSchedule);
router.get('/documents', verifyToken, getDocuments);

export default router;

