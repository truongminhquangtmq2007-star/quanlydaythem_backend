"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const documentController_1 = require("../controllers/documentController");
const router = (0, express_1.Router)();
router.get('/', authMiddleware_1.verifyToken, documentController_1.getAllDocuments);
router.post('/', authMiddleware_1.verifyToken, documentController_1.addDocument);
router.put('/:id', authMiddleware_1.verifyToken, documentController_1.updateDocument);
router.delete('/:id', authMiddleware_1.verifyToken, documentController_1.deleteDocument);
exports.default = router;
//# sourceMappingURL=documentRoutes.js.map