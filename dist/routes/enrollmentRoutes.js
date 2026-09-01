"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
// 1. Gộp tất cả các hàm từ controller vào CÙNG MỘT dòng import
const enrollmentController_1 = require("../controllers/enrollmentController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// 2. Định nghĩa các đường dẫn (Routes) - Đảm bảo tất cả đều có lớp khiên verifyToken
router.get('/', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, enrollmentController_1.getEnrollments);
router.post('/', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, enrollmentController_1.enrollStudent); // Chỉ giữ lại 1 cổng POST
router.put('/:id', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, enrollmentController_1.updateEnrollmentStatus);
router.delete('/:id', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, enrollmentController_1.deleteEnrollment);
router.get('/:class_id', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, enrollmentController_1.getStudentsInClass);
router.get('/student/:student_id', authMiddleware_1.verifyToken, enrollmentController_1.getClassesForStudent);
exports.default = router;
//# sourceMappingURL=enrollmentRoutes.js.map