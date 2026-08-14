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

import { verifyToken } from '../middleware/authMiddleware';

const router = Router();

// 2. Định nghĩa các đường dẫn (Routes) - Đảm bảo tất cả đều có lớp khiên verifyToken
router.get('/', verifyToken, getEnrollments);
router.post('/', verifyToken, enrollStudent); // Chỉ giữ lại 1 cổng POST
router.put('/:id', verifyToken, updateEnrollmentStatus);
router.delete('/:id', verifyToken, deleteEnrollment);

router.get('/:class_id', verifyToken, getStudentsInClass); 
router.get('/student/:student_id', verifyToken, getClassesForStudent);

export default router;