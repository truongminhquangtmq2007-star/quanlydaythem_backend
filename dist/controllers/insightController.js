"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateInsight = exports.getLatestInsight = void 0;
const db_1 = __importDefault(require("../db"));
const learningInsightService_1 = require("../services/learningInsightService");
const getLatestInsight = async (req, res) => {
    try {
        if (req.user?.role === 'STUDENT') {
            res.status(403).json({ message: 'Học sinh không có quyền truy cập báo cáo phân tích cá nhân này.' });
            return;
        }
        const studentId = req.params.studentId || req.query.studentId || req.body.studentId;
        if (!studentId) {
            res.status(400).json({ message: 'Thiếu studentId.' });
            return;
        }
        if (req.user?.role === 'TEACHER') {
            const check = await db_1.default.query(`SELECT 1 FROM students s
                 LEFT JOIN enrollments e ON s.id = e.student_id
                 LEFT JOIN classes c ON e.class_id = c.id
                 WHERE s.id = $1 AND (s.teacher_id = $2 OR c.teacher_id = $2)`, [studentId, req.user.id]);
            if (check.rows.length === 0) {
                res.status(403).json({ message: "Không có quyền xem phân tích của học sinh này" });
                return;
            }
        }
        const result = await db_1.default.query(`
            SELECT payload, generated_at, expires_at 
            FROM student_ai_insights 
            WHERE student_id = $1 AND insight_type = 'CURRENT_PROGRESS'
        `, [studentId]);
        if (result.rows.length === 0) {
            res.status(404).json({ message: 'Chưa có phân tích.' });
            return;
        }
        res.status(200).json({
            status: 'success',
            data: {
                insight: result.rows[0].payload,
                generated_at: result.rows[0].generated_at,
                expires_at: result.rows[0].expires_at
            }
        });
    }
    catch (error) {
        console.error("Lỗi getLatestInsight:", error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};
exports.getLatestInsight = getLatestInsight;
const generateInsight = async (req, res) => {
    try {
        if (req.user?.role === 'STUDENT') {
            res.status(403).json({ message: 'Học sinh không có quyền kích hoạt phân tích cá nhân.' });
            return;
        }
        const studentId = req.params.studentId || req.body.studentId || req.query.studentId;
        if (!studentId) {
            res.status(400).json({ message: 'Thiếu studentId.' });
            return;
        }
        if (req.user?.role === 'TEACHER') {
            const check = await db_1.default.query(`SELECT 1 FROM students s
                 LEFT JOIN enrollments e ON s.id = e.student_id
                 LEFT JOIN classes c ON e.class_id = c.id
                 WHERE s.id = $1 AND (s.teacher_id = $2 OR c.teacher_id = $2)`, [studentId, req.user.id]);
            if (check.rows.length === 0) {
                res.status(403).json({ message: "Không có quyền phân tích học sinh này" });
                return;
            }
        }
        // 1. Build Data Snapshot
        const snapshot = await (0, learningInsightService_1.buildLearningSnapshot)(studentId);
        if (snapshot.dataQuality === 'INSUFFICIENT') {
            res.status(422).json({
                status: 'insufficient_data',
                message: 'Chưa có đủ dữ liệu để phân tích cá nhân hóa. (Cần ít nhất 1 bài thi hoặc các buổi học gần đây)'
            });
            return;
        }
        // 2. Generate Insight with AI
        const aiResponse = await (0, learningInsightService_1.generateStudentPersonalizedInsight)(snapshot);
        // 3. Persist to DB (Upsert)
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days expiration
        await db_1.default.query(`
            INSERT INTO student_ai_insights (student_id, insight_type, payload, prompt_version, model, expires_at)
            VALUES ($1, 'CURRENT_PROGRESS', $2, 'PERSONALIZATION_PROMPT_V1', 'gemini-2.5-flash', $3)
            ON CONFLICT (student_id, insight_type) 
            DO UPDATE SET 
                payload = EXCLUDED.payload, 
                generated_at = CURRENT_TIMESTAMP, 
                expires_at = EXCLUDED.expires_at,
                prompt_version = EXCLUDED.prompt_version,
                model = EXCLUDED.model
        `, [studentId, JSON.stringify(aiResponse), expiresAt]);
        // 4. Return
        res.status(200).json({
            status: 'success',
            data: {
                insight: aiResponse,
                generated_at: new Date(),
                expires_at: expiresAt
            }
        });
    }
    catch (error) {
        console.error("Lỗi generateInsight:", error);
        if (error.message === 'INSUFFICIENT_DATA') {
            res.status(422).json({ status: 'insufficient_data', message: 'Không đủ dữ liệu.' });
        }
        else {
            res.status(500).json({ status: 'error', message: 'Lỗi khi gọi AI Service. Vui lòng thử lại sau.' });
        }
    }
};
exports.generateInsight = generateInsight;
//# sourceMappingURL=insightController.js.map