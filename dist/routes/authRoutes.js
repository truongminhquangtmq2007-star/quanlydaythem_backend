"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
// 1. Cập nhật dòng import Controller (Thêm createTeacher)
const authController_1 = require("../controllers/authController");
// 2. Import thêm ổ khóa bảo vệ từ file middleware của bạn
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// Các cổng đăng nhập công khai (Không cần token)
router.post('/register', authController_1.register);
router.post('/login', authController_1.login);
router.post('/student/login', authController_1.studentLogin);
// ==========================================
// CÁC CỔNG BẢO MẬT (Chỉ Admin mới được vào)
// ==========================================
// Lấy danh sách giáo viên
router.get('/teachers', authMiddleware_1.verifyToken, authMiddleware_1.isAdmin, authController_1.getTeachers);
// Tạo giáo viên mới
router.post('/teachers', authMiddleware_1.verifyToken, authMiddleware_1.isAdmin, authController_1.createTeacher);
router.put('/teachers/:id/reset-password', authMiddleware_1.verifyToken, authMiddleware_1.isAdmin, authController_1.resetTeacherPassword);
router.get('/me', authMiddleware_1.verifyToken, authController_1.getMe);
router.put('/profile', authMiddleware_1.verifyToken, authController_1.updateProfile);
exports.default = router;
//# sourceMappingURL=authRoutes.js.map