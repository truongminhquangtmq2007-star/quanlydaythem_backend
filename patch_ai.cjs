const fs = require('fs');

let code = `
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
        const qRes = await pool.query(\`SELECT content FROM questions WHERE id = $1\`, [question_id]);
        if (qRes.rows.length === 0) {
            res.status(404).json({ message: 'Không tìm thấy câu hỏi' });
            return;
        }
        
        const questionContent = qRes.rows[0].content;

        // Truy vấn lấy đáp án đúng
        const optRes = await pool.query(\`SELECT content FROM question_options WHERE question_id = $1 AND is_correct = true\`, [question_id]);
        
        let correctAnswerText = 'Không tìm thấy đáp án đúng';
        if (optRes.rows.length > 0) {
            correctAnswerText = optRes.rows.map(o => o.content).join(', ');
        }

        let learningGoals = 'Chưa có';
        let classType = 'OFFLINE';

        if (targetStudentId) {
            const studentRes = await pool.query('SELECT * FROM students WHERE id = $1', [targetStudentId]);
            if (studentRes.rows.length > 0) learningGoals = studentRes.rows[0].learning_goals || 'Chưa có';

            const classRes = await pool.query(\`
                SELECT c.class_type FROM enrollments cm
                JOIN classes c ON cm.class_id = c.id
                WHERE cm.student_id = $1
                LIMIT 1
            \`, [targetStudentId]);
            if (classRes.rows.length > 0) classType = classRes.rows[0].class_type;
        }

        let classTypeContext = classType === 'ONLINE' 
            ? 'Lưu ý: Học sinh này đang học Online. Hãy nhắc nhở về sự tập trung trên môi trường số nếu cần.' 
            : 'Lưu ý: Học sinh này đang học Offline. Hãy nhắc nhở về sự chú ý và tương tác trực tiếp.';

        const prompt = \`Học sinh chọn sai đáp án \${student_answer} thay vì \${correctAnswerText} cho câu hỏi Toán: \${questionContent}.
Hãy đóng vai Huấn luyện viên cá nhân (Coach Mode), không giải đáp thẳng mà:
1. Dùng phương pháp Socrates, gợi mở tư duy để học sinh tự nhận ra lỗi sai.
2. Dùng định dạng Markdown và bọc công thức Toán học bằng $ hoặc $$.

Bối cảnh học sinh:
- Mục tiêu ngắn hạn: \${learningGoals}
- Hình thức học: \${classTypeContext}
3. Liên hệ khéo léo đến mục tiêu ngắn hạn của học sinh để truyền động lực.\`;

        const explanationResult = await generateWithFallback(prompt);
        const explanation = explanationResult.response.text();
        res.status(200).json({ explanation });
    } catch (error) {
        console.error('Lỗi explainError controller:', error);
        res.status(500).json({ message: 'Lỗi server khi nhờ AI giải thích' });
    }
};

export const generateRemark = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { student_id } = req.body;
        if (!student_id) {
            res.status(400).json({ message: 'Thiếu student_id' });
            return;
        }

        const studentRes = await pool.query('SELECT full_name FROM students WHERE id = $1', [student_id]);
        if (studentRes.rows.length === 0) {
            res.status(404).json({ message: 'Không tìm thấy học sinh' });
            return;
        }
        const studentName = studentRes.rows[0].full_name;
        const learningGoals = studentRes.rows[0].learning_goals || 'Chưa có';

        // Lấy class type
        let classType = 'OFFLINE';
        const classRes = await pool.query(\`
            SELECT c.class_type FROM enrollments cm
            JOIN classes c ON cm.class_id = c.id
            WHERE cm.student_id = $1
            LIMIT 1
        \`, [student_id]);
        if (classRes.rows.length > 0) classType = classRes.rows[0].class_type;

        // Điểm trung bình (Mock)
        const avgScore = 8.5;

        // Chuyên cần
        const attRes = await pool.query(\`SELECT status FROM attendance WHERE student_id = $1 ORDER BY attendance_date DESC LIMIT 10\`, [student_id]);
        const present = attRes.rows.filter(a => a.status === 'PRESENT').length;
        const attRate = attRes.rows.length > 0 ? Math.round((present / attRes.rows.length) * 100) : 100;

        // Nợ học phí
        const billsRes = await pool.query(\`SELECT amount, month, year FROM tuition_bills WHERE student_id = $1 AND is_paid = false\`, [student_id]);
        const debtText = billsRes.rows.length > 0 
            ? \`Còn nợ \${billsRes.rows.map(b => \`\${Number(b.amount).toLocaleString('vi-VN')}đ (tháng \${b.month}/\${b.year})\`).join(', ')}\`
            : \`Đã đóng đủ học phí\`;

        let classTypeContext = classType === 'ONLINE' 
            ? 'Vì là lớp Online, hãy khen ngợi/nhắc nhở sự tự giác nộp bài qua link và sự tập trung trước màn hình.' 
            : 'Vì là lớp Offline, hãy nhấn mạnh vào thái độ làm việc trực tiếp và sự chú ý nghe giảng trên lớp.';

        const prompt = \`Bạn là Huấn luyện viên đào tạo (Coach Mode). Dựa trên dữ liệu học sinh này:
- Tên: \${studentName}
- Điểm trung bình: \${avgScore}
- Chuyên cần: \${attRate}%
- Tài chính: \${debtText}
- Mục tiêu cá nhân: \${learningGoals}
\${classTypeContext}
Hãy viết một đoạn nhận xét ngắn gọn (dưới 100 chữ), khéo léo, mang tính động viên tiến bộ cá nhân, thái độ học tập và nhắc nhở đóng học phí (nếu còn nợ) để gửi cho phụ huynh. Trả về Markdown định dạng chuyên nghiệp.\`;

        const remarkResult = await generateWithFallback(prompt);
        const remark = remarkResult.response.text();
        res.status(200).json({ remark });
    } catch (error) {
        console.error('Lỗi generateRemark:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};
`;

fs.writeFileSync('src/controllers/aiController.ts', code);
console.log('Fixed aiController');

