"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const classController_1 = require("../controllers/classController");
const classDocumentController_1 = require("../controllers/classDocumentController");
const assignmentController_1 = require("../controllers/assignmentController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
router.get('/', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, classController_1.getClasses);
router.get('/:id', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, classController_1.getClass);
router.post('/', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, classController_1.createClass);
router.put('/:id', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, classController_1.updateClass);
router.delete('/:id', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, classController_1.deleteClass);
router.put('/:id/assign-teacher', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, classController_1.assignTeacher);
// ==========================================
// API MỚI CHO PHASE 1 - CORE
// ==========================================
router.get('/:id/members', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, classController_1.getClassMembers);
router.post('/:id/members', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, classController_1.addMember);
router.delete('/:id/members/:studentId', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, classController_1.removeMember);
router.get('/:id/sessions', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, classController_1.getClassSessions);
router.post('/:id/sessions', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, classController_1.createSession);
router.get('/:id/assignments', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, assignmentController_1.getClassAssignments);
router.delete('/:id/assignments/:assignmentId', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, assignmentController_1.deleteAssignment);
router.delete('/assignments/:id', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, assignmentController_1.deleteAssignment);
router.get('/sessions/:id/attendance', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, classController_1.getSessionAttendance);
router.put('/sessions/:id/attendance', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, classController_1.updateAttendance);
router.get('/:id/assignable-documents', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, classDocumentController_1.getAssignableDocuments);
router.post('/:id/assign-documents', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, classDocumentController_1.assignDocumentsToClass);
exports.default = router;
//# sourceMappingURL=classRoutes.js.map