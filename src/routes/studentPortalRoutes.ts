import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware';
import { getDashboard, getSchedule, getDocuments, getExams, updateEmail } from '../controllers/studentPortalController';

const router = Router();

router.get('/dashboard', verifyToken, getDashboard);
router.put('/email', verifyToken, updateEmail);
router.get('/schedule', verifyToken, getSchedule);
router.get('/documents', verifyToken, getDocuments);
router.get('/exams', verifyToken, getExams);

export default router;


