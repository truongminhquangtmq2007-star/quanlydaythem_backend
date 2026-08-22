import { Router } from 'express';
import { getStudents, createStudent, updateStudent, deleteStudent, getProfile360, updateStudentGoals, resetStudentPassword } from '../controllers/studentController';
import { verifyToken, isAdmin } from '../middleware/authMiddleware';
import { validateStudent } from '../validations/studentValidation';

const router = Router();

router.get('/', verifyToken, getStudents);
router.post('/', verifyToken, validateStudent, createStudent);
router.get('/:id/profile360', verifyToken, getProfile360);
router.put('/:id', verifyToken, validateStudent, updateStudent);
router.delete('/:id', verifyToken, isAdmin, deleteStudent);
router.put('/:id/goals', verifyToken, updateStudentGoals);
router.put('/:id/reset-password', verifyToken, isAdmin, resetStudentPassword);

export default router;