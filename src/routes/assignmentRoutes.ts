import { Router } from 'express';
import { createAssignment } from '../controllers/assignmentController';
import { verifyToken, isAdmin } from '../middleware/authMiddleware';

const router = Router();

router.post('/', verifyToken, isAdmin, createAssignment);

export default router;

