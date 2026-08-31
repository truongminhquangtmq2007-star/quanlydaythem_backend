import { Router } from 'express';
import { upsertSession, publishSessions, getSessions, deleteSession, getPublishedSessions, getEvaluations, saveEvaluation, markSessionsAsBilled, syncCalendar } from '../controllers/sessionController';
import { verifyToken, isTeacherOrAdmin } from '../middleware/authMiddleware'; 

const router = Router();

// Cổng của Giáo viên (Kéo toàn bộ lịch)
router.get('/', verifyToken, isTeacherOrAdmin, getSessions);

// Cổng của Học sinh/Phụ huynh (Chỉ kéo lịch đã công bố)
router.get('/published', verifyToken, getPublishedSessions);

router.post('/upsert', verifyToken, isTeacherOrAdmin, upsertSession);
router.post('/publish', verifyToken, isTeacherOrAdmin, publishSessions);
router.delete('/:id', verifyToken, isTeacherOrAdmin, deleteSession);

// [ĐÃ SỬA] Đổi '/evaluations' thành '/evaluate' cho khớp với Frontend
// [ĐÃ SỬA] Bổ sung verifyToken cho toàn bộ các API bên dưới
router.get('/evaluations', verifyToken, isTeacherOrAdmin, getEvaluations);
router.post('/evaluate', verifyToken, isTeacherOrAdmin, saveEvaluation);
router.post('/mark-billed', verifyToken, isTeacherOrAdmin, markSessionsAsBilled);

router.post('/:id/sync-calendar', verifyToken, isTeacherOrAdmin, syncCalendar);

export default router;