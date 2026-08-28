"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const analyticsController_1 = require("../controllers/analyticsController");
const router = (0, express_1.Router)();
// Routes phân tích
router.get('/students/:id/topics', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, analyticsController_1.getStudentTopics);
router.get('/classes/:id/weak-topics', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, analyticsController_1.getClassWeakTopics);
exports.default = router;
//# sourceMappingURL=analyticsRoutes.js.map