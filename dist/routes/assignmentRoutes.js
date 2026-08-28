"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const assignmentController_1 = require("../controllers/assignmentController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
router.post('/', authMiddleware_1.verifyToken, authMiddleware_1.isAdmin, assignmentController_1.createAssignment);
exports.default = router;
//# sourceMappingURL=assignmentRoutes.js.map