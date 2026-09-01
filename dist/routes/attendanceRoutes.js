"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const attendanceController_1 = require("../controllers/attendanceController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
router.get('/', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, attendanceController_1.getAttendance);
router.post('/', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, attendanceController_1.markAttendance);
exports.default = router;
//# sourceMappingURL=attendanceRoutes.js.map