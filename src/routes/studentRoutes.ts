import { Router } from 'express';
import { getStudents, searchGlobalStudents, createStudent, updateStudent, deleteStudent, getProfile360, updateStudentGoals, resetStudentPassword , generateAIEvaluation } from '../controllers/studentController';
import { verifyToken, isAdmin, isTeacherOrAdmin } from '../middleware/authMiddleware';
import { validateStudent } from '../validations/studentValidation';

const router = Router();

router.get('/', verifyToken, getStudents);
router.get('/search', verifyToken, isTeacherOrAdmin, searchGlobalStudents);
router.post('/', verifyToken, validateStudent, createStudent);
router.get('/:id/profile360', verifyToken, getProfile360);
router.put('/:id', verifyToken, validateStudent, updateStudent);
router.delete('/:id', verifyToken, isAdmin, deleteStudent);
router.put('/:id/goals', verifyToken, updateStudentGoals);
router.put('/:id/reset-password', verifyToken, isAdmin, resetStudentPassword);

router.post('/:id/ai-evaluation', verifyToken, generateAIEvaluation);

export default router;
