"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const examController_1 = require("../controllers/examController");
const uploadMiddleware_1 = require("../middleware/uploadMiddleware");
const router = (0, express_1.Router)();
// Phase 3 Routes (Exam Engine)
router.get('/', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, examController_1.getAllExams);
router.post('/publish', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, examController_1.publishExam);
// Cấu hình Multer lưu file tạm vào RAM (bộ nhớ đệm)
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
// ==========================================
// ROUTES CHO GIÁO VIÊN
// ==========================================
// 1. Nhập/Sửa đáp án thủ công
router.post('/key', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, examController_1.saveAnswerKey);
// 2. Tự động bóc tách đề và tạo đáp án bằng AI (Text)
router.post('/parse-ai-text', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, examController_1.createExamFromText);
// 3. Tự động bóc tách đề từ FILE (PDF/Ảnh)
router.post('/parse-ai-file', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, uploadMiddleware_1.uploadMemory.single('examFile'), examController_1.parseExamFromFile);
// 4. Lấy danh sách học sinh đã nộp bài của một đề
router.get('/:document_id/submissions', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, examController_1.getExamSubmissions);
// 5. Lấy lại đáp án chuẩn đã lưu / tải đề thi làm bài
router.get('/key/:document_id', authMiddleware_1.verifyToken, examController_1.getExamKey);
// ==========================================
// ROUTES CHO HỌC SINH
// ==========================================
// Lưu nháp và lấy nháp
const examController_2 = require("../controllers/examController");
router.get('/:id/draft', authMiddleware_1.verifyToken, examController_2.getDraftExam);
router.post('/:id/draft', authMiddleware_1.verifyToken, examController_2.saveDraftExam);
// 6. Nộp bài trắc nghiệm và chấm điểm tự động
router.post('/:id/submit', authMiddleware_1.verifyToken, examController_1.submitExam);
router.post('/submit', authMiddleware_1.verifyToken, examController_1.submitExam);
// 7. Lấy lịch sử điểm thi cá nhân & chi tiết từng lần thi
router.get('/my-submissions', authMiddleware_1.verifyToken, examController_1.getMySubmissions);
router.get('/submissions/:id', authMiddleware_1.verifyToken, examController_1.getSubmissionDetail);
// Gia sư AI giải đáp thắc mắc
router.post('/ask-tutor', authMiddleware_1.verifyToken, examController_1.askAITutor);
exports.default = router;
//# sourceMappingURL=examRoutes.js.map