import { Router } from 'express';
import { createAssignment } from '../controllers/assignmentController';
import { verifyToken, isTeacherOrAdmin } from '../middleware/authMiddleware';

const router = Router();

router.post('/', verifyToken, isTeacherOrAdmin, createAssignment);

export default router;

