import { Router } from 'express';
import { getAttendance, markAttendance } from '../controllers/attendanceController';

const router = Router();

router.get('/', getAttendance);
router.post('/', markAttendance);

export default router;