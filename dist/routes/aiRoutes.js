"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const aiController_1 = require("../controllers/aiController");
const router = (0, express_1.Router)();
// Route cho AI
router.post('/explain-error', authMiddleware_1.verifyToken, aiController_1.explainError);
router.post('/generate-remark', authMiddleware_1.verifyToken, aiController_1.generateRemark);
exports.default = router;
//# sourceMappingURL=aiRoutes.js.map