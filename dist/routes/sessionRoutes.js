"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sessionController_1 = require("../controllers/sessionController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// Cổng của Giáo viên (Kéo toàn bộ lịch)
router.get('/', authMiddleware_1.verifyToken, sessionController_1.getSessions);
// Cổng của Học sinh/Phụ huynh (Chỉ kéo lịch đã công bố)
router.get('/published', authMiddleware_1.verifyToken, sessionController_1.getPublishedSessions);
router.post('/upsert', authMiddleware_1.verifyToken, sessionController_1.upsertSession);
router.post('/publish', authMiddleware_1.verifyToken, sessionController_1.publishSessions);
router.delete('/:id', authMiddleware_1.verifyToken, sessionController_1.deleteSession);
// [ĐÃ SỬA] Đổi '/evaluations' thành '/evaluate' cho khớp với Frontend
// [ĐÃ SỬA] Bổ sung verifyToken cho toàn bộ các API bên dưới
router.get('/evaluations', authMiddleware_1.verifyToken, sessionController_1.getEvaluations);
router.post('/evaluate', authMiddleware_1.verifyToken, sessionController_1.saveEvaluation);
router.post('/mark-billed', authMiddleware_1.verifyToken, sessionController_1.markSessionsAsBilled);
router.post('/:id/sync-calendar', authMiddleware_1.verifyToken, sessionController_1.syncCalendar);
exports.default = router;
//# sourceMappingURL=sessionRoutes.js.map