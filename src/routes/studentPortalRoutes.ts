import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware';
import { getDashboard, getSchedule, getDocuments, getStudentExams, updateEmail } from '../controllers/studentPortalController';

const router = Router();

router.get('/dashboard', verifyToken, getDashboard);
router.put('/email', verifyToken, updateEmail);
router.get('/schedule', verifyToken, getSchedule);
router.get('/documents', verifyToken, getDocuments);
router.get('/exams', verifyToken, getStudentExams);

export default router;

