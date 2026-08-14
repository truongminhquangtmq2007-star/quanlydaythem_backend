import { Router } from 'express';
import { getClasses, createClass, updateClass, deleteClass } from '../controllers/classController';
import { assignTeacher } from '../controllers/classController';
import { verifyToken, isAdmin } from '../middleware/authMiddleware';

const router = Router();

// 2. Chèn bảo vệ vào trước mọi thao tác
router.get('/', verifyToken, getClasses);
router.post('/', verifyToken, isAdmin, createClass);
router.put('/:id', verifyToken, isAdmin, updateClass);
router.delete('/:id', verifyToken, isAdmin, deleteClass);
router.put('/:id/assign-teacher', verifyToken, isAdmin, assignTeacher);
export default router;