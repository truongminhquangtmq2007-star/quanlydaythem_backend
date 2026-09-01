"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const documentController_1 = require("../controllers/documentController");
const router = (0, express_1.Router)();
router.get('/drive', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, documentController_1.getDrive);
router.get('/:folderId/contents', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, documentController_1.getFolderContents);
router.post('/', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, documentController_1.createFolder);
router.put('/:id', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, documentController_1.updateFolder);
router.delete('/:id', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, documentController_1.deleteFolder);
exports.default = router;
//# sourceMappingURL=folderRoutes.js.map