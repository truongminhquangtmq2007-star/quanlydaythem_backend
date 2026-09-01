"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const studentPortalController_1 = require("../controllers/studentPortalController");
const router = (0, express_1.Router)();
router.get('/dashboard', authMiddleware_1.verifyToken, studentPortalController_1.getDashboard);
router.put('/email', authMiddleware_1.verifyToken, studentPortalController_1.updateEmail);
router.get('/schedule', authMiddleware_1.verifyToken, studentPortalController_1.getSchedule);
router.get('/documents', authMiddleware_1.verifyToken, studentPortalController_1.getDocuments);
router.get('/exams', authMiddleware_1.verifyToken, studentPortalController_1.getStudentExams);
exports.default = router;
//# sourceMappingURL=studentPortalRoutes.js.map