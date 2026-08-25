import { Router } from 'express';
import multer from 'multer';
import { verifyToken, isAdmin, isTeacherOrAdmin } from '../middleware/authMiddleware';
import { 
    saveAnswerKey, 
    submitExam, 
    getExamSubmissions, 
    getMySubmissions, 
    getExamKey,
    askAITutor,
    createExamFromText,
    parseExamFromFile,
    getAllExams,
    publishExam
} from '../controllers/examController';
import { uploadMemory } from '../middleware/uploadMiddleware';

const router = Router();

// Phase 3 Routes (Exam Engine)
router.get('/', verifyToken, isTeacherOrAdmin, getAllExams);
router.post('/publish', verifyToken, isTeacherOrAdmin, publishExam);

// Cấu hình Multer lưu file tạm vào RAM (bộ nhớ đệm)
const upload = multer({ storage: multer.memoryStorage() });

// ==========================================
// ROUTES CHO GIÁO VIÊN
// ==========================================
// 1. Nhập/Sửa đáp án thủ công
router.post('/key', verifyToken, saveAnswerKey);

// 2. Tự động bóc tách đề và tạo đáp án bằng AI (Text)
// Sửa dòng này:
router.post('/parse-ai-text', verifyToken, createExamFromText);
// 3. Tự động bóc tách đề từ FILE (PDF/Ảnh)
router.post('/parse-ai-file', verifyToken, uploadMemory.single('examFile'), parseExamFromFile);
// 4. Lấy danh sách học sinh đã nộp bài của một đề
router.get('/:document_id/submissions', verifyToken, getExamSubmissions);

// 5. Lấy lại đáp án chuẩn đã lưu
router.get('/key/:document_id', verifyToken, getExamKey);


// ==========================================
// ROUTES CHO HỌC SINH
// ==========================================
// Lưu nháp và lấy nháp
import { getDraftExam, saveDraftExam } from '../controllers/examController';
router.get('/:id/draft', verifyToken, getDraftExam);
router.post('/:id/draft', verifyToken, saveDraftExam);

// 6. Nộp bài trắc nghiệm và chấm điểm tự động
router.post('/:id/submit', verifyToken, submitExam);
router.post('/submit', verifyToken, submitExam);

// 7. Lấy lịch sử điểm thi cá nhân
router.get('/my-submissions', verifyToken, getMySubmissions);

export default router;
// Gia sư AI giải đáp thắc mắc
router.post('/ask-tutor', verifyToken, askAITutor);
