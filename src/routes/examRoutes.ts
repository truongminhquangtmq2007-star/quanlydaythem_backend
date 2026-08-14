import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware';
import { saveAnswerKey, submitExam, getExamSubmissions, getMySubmissions, getExamKey } from '../controllers/examController';
const router = Router();

// Route cho Giáo viên: Nhập/Sửa đáp án
router.post('/key', verifyToken, saveAnswerKey);

// Route cho Học sinh: Nộp bài trắc nghiệm
router.post('/submit', verifyToken, submitExam);
router.get('/:document_id/submissions', verifyToken, getExamSubmissions);
router.get('/my-submissions', verifyToken, getMySubmissions); // Thêm dòng này
router.get('/key/:document_id', verifyToken, getExamKey); // Thêm dòng này
export default router;