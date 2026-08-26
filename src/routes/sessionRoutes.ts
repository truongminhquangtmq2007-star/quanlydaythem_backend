import { Router } from 'express';
import { upsertSession, publishSessions, getSessions, deleteSession, getPublishedSessions, getEvaluations, saveEvaluation, markSessionsAsBilled, syncCalendar } from '../controllers/sessionController';
import { verifyToken } from '../middleware/authMiddleware'; 

const router = Router();

// Cổng của Giáo viên (Kéo toàn bộ lịch)
router.get('/', verifyToken, getSessions);

// Cổng của Học sinh/Phụ huynh (Chỉ kéo lịch đã công bố)
router.get('/published', verifyToken, getPublishedSessions);

router.post('/upsert', verifyToken, upsertSession);
router.post('/publish', verifyToken, publishSessions);
router.delete('/:id', verifyToken, deleteSession);

// [ĐÃ SỬA] Đổi '/evaluations' thành '/evaluate' cho khớp với Frontend
// [ĐÃ SỬA] Bổ sung verifyToken cho toàn bộ các API bên dưới
router.get('/evaluations', verifyToken, getEvaluations);
router.post('/evaluate', verifyToken, saveEvaluation);
router.post('/mark-billed', verifyToken, markSessionsAsBilled);

router.post('/:id/sync-calendar', verifyToken, syncCalendar);

export default router;