"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const reportController_1 = require("../controllers/reportController");
const router = (0, express_1.Router)();
// Route cho báo cáo
router.get('/students/:id/weekly', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, reportController_1.getWeeklyReport);
exports.default = router;
//# sourceMappingURL=reportRoutes.js.map