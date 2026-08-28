"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const uploadController_1 = require("../controllers/uploadController");
const router = (0, express_1.Router)();
router.post('/image', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, uploadController_1.uploadImage);
router.post('/document', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, uploadController_1.uploadDocument);
exports.default = router;
//# sourceMappingURL=uploadRoutes.js.map