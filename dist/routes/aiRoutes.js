"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const aiController_1 = require("../controllers/aiController");
const insightController_1 = require("../controllers/insightController");
const router = (0, express_1.Router)();
// Route cho Student AI: Hỏi đáp & Giải thích câu hỏi
router.post('/explain-error', authMiddleware_1.verifyToken, aiController_1.explainError);
// Route cho Teacher AI: Nhận xét học phí, đánh giá và phân tích cá nhân hóa (Bảo vệ nghiêm ngặt)
router.post('/generate-remark', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, aiController_1.generateRemark);
router.post('/save-remark', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, aiController_1.saveRemark);
router.get('/remark/:studentId/:month', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, aiController_1.getRemark);
// Phân tích kết quả học tập cá nhân hóa: Cho phép Học sinh xem/tạo của chính mình, Giáo viên/Admin xem theo thẩm quyền
router.get('/insight/:studentId', authMiddleware_1.verifyToken, insightController_1.getLatestInsight);
router.post('/insight/generate', authMiddleware_1.verifyToken, insightController_1.generateInsight);
exports.default = router;
//# sourceMappingURL=aiRoutes.js.map