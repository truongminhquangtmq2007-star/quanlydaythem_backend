import { Router } from 'express';
import multer from 'multer';
import { verifyToken } from '../middleware/authMiddleware';
import { 
    saveAnswerKey, 
    submitExam, 
    getExamSubmissions, 
    getMySubmissions, 
    getExamKey,
    createExamFromText,
    parseExamFromFile
} from '../controllers/examController';
import { uploadMemory } from '../middleware/uploadMiddleware';

const router = Router();

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
// 6. Nộp bài trắc nghiệm
router.post('/submit', verifyToken, submitExam);

// 7. Lấy lịch sử điểm thi cá nhân
router.get('/my-submissions', verifyToken, getMySubmissions);

export default router;