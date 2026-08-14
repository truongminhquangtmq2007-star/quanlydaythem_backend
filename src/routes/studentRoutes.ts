import { Router } from 'express';
import { getStudents, createStudent, updateStudent, deleteStudent } from '../controllers/studentController';
import { verifyToken } from '../middleware/authMiddleware';
// Import bộ lọc vừa tạo
import { validateStudent } from '../validations/studentValidation';

const router = Router();

// Thêm validateStudent vào các API Thêm (POST) và Sửa (PUT)
router.get('/', verifyToken, getStudents);
router.post('/', verifyToken, validateStudent, createStudent);
router.put('/:id', verifyToken, validateStudent, updateStudent);
router.delete('/:id', verifyToken, deleteStudent);

export default router;