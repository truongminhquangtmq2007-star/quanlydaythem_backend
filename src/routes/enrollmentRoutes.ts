import { Router } from 'express';

// 1. Gộp tất cả các hàm từ controller vào CÙNG MỘT dòng import
import { 
  getEnrollments, 
  enrollStudent, 
  updateEnrollmentStatus, 
  deleteEnrollment,
  getStudentsInClass,
  getClassesForStudent
} from '../controllers/enrollmentController';

import { verifyToken, isTeacherOrAdmin } from '../middleware/authMiddleware';

const router = Router();

// 2. Định nghĩa các đường dẫn (Routes) - Đảm bảo tất cả đều có lớp khiên verifyToken
router.get('/', verifyToken, isTeacherOrAdmin, getEnrollments);
router.post('/', verifyToken, isTeacherOrAdmin, enrollStudent); // Chỉ giữ lại 1 cổng POST
router.put('/:id', verifyToken, isTeacherOrAdmin, updateEnrollmentStatus);
router.delete('/:id', verifyToken, isTeacherOrAdmin, deleteEnrollment);

router.get('/:class_id', verifyToken, isTeacherOrAdmin, getStudentsInClass); 
router.get('/student/:student_id', verifyToken, getClassesForStudent);

export default router;