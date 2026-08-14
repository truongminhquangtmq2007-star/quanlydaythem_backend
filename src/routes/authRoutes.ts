import { Router } from 'express';

// 1. Cập nhật dòng import Controller (Thêm createTeacher)
import { register, login, studentLogin, getTeachers, createTeacher, resetTeacherPassword } from '../controllers/authController';
// 2. Import thêm ổ khóa bảo vệ từ file middleware của bạn
import { verifyToken, isAdmin } from '../middleware/authMiddleware'; 

const router = Router();

// Các cổng đăng nhập công khai (Không cần token)
router.post('/register', register);
router.post('/login', login);
router.post('/student/login', studentLogin);

// ==========================================
// CÁC CỔNG BẢO MẬT (Chỉ Admin mới được vào)
// ==========================================

// Lấy danh sách giáo viên
router.get('/teachers', verifyToken, isAdmin, getTeachers);

// Tạo giáo viên mới
router.post('/teachers', verifyToken, isAdmin, createTeacher);

router.put('/teachers/:id/reset-password', verifyToken, isAdmin, resetTeacherPassword);

export default router;