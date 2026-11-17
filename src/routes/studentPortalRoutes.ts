import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware';
import { getDashboard, getSchedule, getDocuments, getStudentExams, updateEmail } from '../controllers/studentPortalController';
import { getLatestInsight, generateInsight } from '../controllers/insightController';

const router = Router();

router.get('/dashboard', verifyToken, getDashboard);
router.put('/email', verifyToken, updateEmail);
router.get('/schedule', verifyToken, getSchedule);
router.get('/documents', verifyToken, getDocuments);
router.get('/exams', verifyToken, getStudentExams);
router.get('/ai-insights', verifyToken, getLatestInsight);
router.post('/ai-insights/generate', verifyToken, generateInsight);

export default router;

