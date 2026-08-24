
import { Response } from 'express';
import pool from '../db';
import { AuthRequest } from '../middleware/authMiddleware';
import { generateWithFallback } from '../services/geminiService';

export const explainError = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { question_id, student_answer, student_id } = req.body;
        if (!question_id || student_answer === undefined) {
            res.status(400).json({ message: 'Thiếu thông tin question_id hoặc student_answer' });
            return;
        }

        const targetStudentId = student_id || req.user?.student_id;
        const qRes = await pool.query(`SELECT content FROM questions WHERE id = $1`, [question_id]);
        if (qRes.rows.length === 0) {
            res.status(404).json({ message: 'Không tìm thấy câu hỏi' });
            return;
        }
        
        const questionContent = qRes.rows[0].content;

        // Truy vấn lấy đáp án đúng
        const optRes = await pool.query(`SELECT content FROM question_options WHERE question_id = $1 AND is_correct = true`, [question_id]);
        
        let correctAnswerText = 'Không tìm thấy đáp án đúng';
        if (optRes.rows.length > 0) {
            correctAnswerText = optRes.rows.map(o => o.content).join(', ');
        }

        let learningGoals = 'Chưa có';
        let classType = 'OFFLINE';

        if (targetStudentId) {
            const studentRes = await pool.query('SELECT * FROM students WHERE id = $1', [targetStudentId]);
            if (studentRes.rows.length > 0) learningGoals = studentRes.rows[0].learning_goals || 'Chưa có';

            const classRes = await pool.query(`
                SELECT c.class_type FROM enrollments cm
                JOIN classes c ON cm.class_id = c.id
                WHERE cm.student_id = $1
                LIMIT 1
            `, [targetStudentId]);
            if (classRes.rows.length > 0) classType = classRes.rows[0].class_type;
        }

        let classTypeContext = classType === 'ONLINE' 
            ? 'Lưu ý: Học sinh này đang học Online. Hãy nhắc nhở về sự tập trung trên môi trường số nếu cần.' 
            : 'Lưu ý: Học sinh này đang học Offline. Hãy nhắc nhở về sự chú ý và tương tác trực tiếp.';

        const prompt = `Học sinh chọn sai đáp án ${student_answer} thay vì ${correctAnswerText} cho câu hỏi Toán: ${questionContent}.
Hãy đóng vai Huấn luyện viên cá nhân (Coach Mode), không giải đáp thẳng mà:
1. Dùng phương pháp Socrates, gợi mở tư duy để học sinh tự nhận ra lỗi sai.
2. Dùng định dạng Markdown và bọc công thức Toán học bằng $ hoặc $$.

Bối cảnh học sinh:
- Mục tiêu ngắn hạn: ${learningGoals}
- Hình thức học: ${classTypeContext}
3. Liên hệ khéo léo đến mục tiêu ngắn hạn của học sinh để truyền động lực.`;

        const explanation = await generateWithFallback(prompt);
        res.status(200).json({ explanation });
    } catch (error) {
        console.error('Lỗi explainError controller:', error);
        res.status(500).json({ message: 'Lỗi server khi nhờ AI giải thích' });
    }
};

export const generateRemark = async (req: AuthRequest, res: Response): Promise<void> => {
    res.status(503).json({ status: "maintenance", message: "Tính năng AI đang bảo trì." });
};
