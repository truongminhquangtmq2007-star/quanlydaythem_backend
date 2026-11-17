"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const studentPortalController_1 = require("../controllers/studentPortalController");
const insightController_1 = require("../controllers/insightController");
const router = (0, express_1.Router)();
router.get('/dashboard', authMiddleware_1.verifyToken, studentPortalController_1.getDashboard);
router.put('/email', authMiddleware_1.verifyToken, studentPortalController_1.updateEmail);
router.get('/schedule', authMiddleware_1.verifyToken, studentPortalController_1.getSchedule);
router.get('/documents', authMiddleware_1.verifyToken, studentPortalController_1.getDocuments);
router.get('/exams', authMiddleware_1.verifyToken, studentPortalController_1.getStudentExams);
router.get('/ai-insights', authMiddleware_1.verifyToken, insightController_1.getLatestInsight);
router.post('/ai-insights/generate', authMiddleware_1.verifyToken, insightController_1.generateInsight);
exports.default = router;
//# sourceMappingURL=studentPortalRoutes.js.map