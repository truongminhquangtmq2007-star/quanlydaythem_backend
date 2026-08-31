import { Router } from 'express';
import { getStudents, createStudent, updateStudent, deleteStudent, getProfile360, updateStudentGoals, resetStudentPassword, generateAIEvaluation, searchGlobalStudents } from '../controllers/studentController';
import { verifyToken, isAdmin, isTeacherOrAdmin } from '../middleware/authMiddleware';
import { validateStudent } from '../validations/studentValidation';

const router = Router();

router.get('/search', verifyToken, isTeacherOrAdmin, searchGlobalStudents);
router.get('/', verifyToken, isTeacherOrAdmin, getStudents);
router.post('/', verifyToken, isTeacherOrAdmin, validateStudent, createStudent);
router.get('/:id/profile360', verifyToken, isTeacherOrAdmin, getProfile360);
router.put('/:id', verifyToken, isTeacherOrAdmin, validateStudent, updateStudent);
router.delete('/:id', verifyToken, isAdmin, deleteStudent);
router.put('/:id/goals', verifyToken, isTeacherOrAdmin, updateStudentGoals);
router.put('/:id/reset-password', verifyToken, isAdmin, resetStudentPassword);

router.post('/:id/ai-evaluation', verifyToken, isTeacherOrAdmin, generateAIEvaluation);

export default router;