"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const studentController_1 = require("../controllers/studentController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const studentValidation_1 = require("../validations/studentValidation");
const router = (0, express_1.Router)();
router.get('/search', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, studentController_1.searchGlobalStudents);
router.get('/', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, studentController_1.getStudents);
router.post('/', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, studentValidation_1.validateStudent, studentController_1.createStudent);
router.get('/:id/profile360', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, studentController_1.getProfile360);
router.put('/:id', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, studentValidation_1.validateStudent, studentController_1.updateStudent);
router.delete('/:id', authMiddleware_1.verifyToken, authMiddleware_1.isAdmin, studentController_1.deleteStudent);
router.put('/:id/goals', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, studentController_1.updateStudentGoals);
router.put('/:id/reset-password', authMiddleware_1.verifyToken, authMiddleware_1.isAdmin, studentController_1.resetStudentPassword);
router.post('/:id/ai-evaluation', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, studentController_1.generateAIEvaluation);
exports.default = router;
//# sourceMappingURL=studentRoutes.js.map