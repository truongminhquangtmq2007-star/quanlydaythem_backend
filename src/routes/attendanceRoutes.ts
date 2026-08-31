import { Router } from 'express';
import { getAttendance, markAttendance } from '../controllers/attendanceController';
import { verifyToken, isTeacherOrAdmin } from '../middleware/authMiddleware';

const router = Router();

router.get('/', verifyToken, isTeacherOrAdmin, getAttendance);
router.post('/', verifyToken, isTeacherOrAdmin, markAttendance);

export default router;