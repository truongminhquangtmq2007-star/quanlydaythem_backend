
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

        let targetStudentId = req.user?.student_id || req.user?.id;
        if (req.user?.role === 'STUDENT') {
            // Student can only query for themselves
            if (student_id && Number(student_id) !== Number(req.user?.student_id || req.user?.id)) {
                res.status(403).json({ message: 'Không có quyền truy cập dữ liệu của học sinh khác.' });
                return;
            }
            targetStudentId = req.user?.student_id || req.user?.id;
        } else if (student_id) {
            targetStudentId = student_id;
        }

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
    try {
        const { student_id, month } = req.body;
        
        if (!student_id || !month) {
            res.status(400).json({ message: 'Thiếu student_id hoặc month (định dạng YYYY-MM).' });
            return;
        }

        if (req.user?.role === 'TEACHER') {
            const check = await pool.query(
                `SELECT 1 FROM students s
                 LEFT JOIN enrollments e ON s.id = e.student_id
                 LEFT JOIN classes c ON e.class_id = c.id
                 WHERE s.id = $1 AND (s.teacher_id = $2 OR c.teacher_id = $2)`,
                [student_id, req.user.id]
            );
            if (check.rows.length === 0) {
                res.status(403).json({ message: "Không có quyền tạo nhận xét cho học sinh này." });
                return;
            }
        }

        const studentRes = await pool.query('SELECT full_name, learning_goals FROM students WHERE id = $1', [student_id]);
        if (studentRes.rows.length === 0) {
            res.status(404).json({ message: 'Không tìm thấy học sinh.' });
            return;
        }
        
        const student = studentRes.rows[0];

        // Lấy dữ liệu attendance trong tháng
        const attendanceRes = await pool.query(
            `SELECT status, COUNT(*) as count FROM attendance 
             WHERE student_id = $1 AND to_char(attendance_date, 'YYYY-MM') = $2 
             GROUP BY status`, 
            [student_id, month]
        );
        let present = 0, absent = 0, late = 0;
        attendanceRes.rows.forEach(r => {
            if (r.status === 'PRESENT') present = parseInt(r.count, 10);
            if (r.status === 'ABSENT' || r.status === 'ABSENT_UNEXCUSED' || r.status === 'ABSENT_EXCUSED') absent += parseInt(r.count, 10);
            if (r.status === 'LATE') late = parseInt(r.count, 10);
        });

        // Lấy dữ liệu thi cử trong tháng (chỉ lấy bài thi đã hoàn thành)
        const examRes = await pool.query(
            `SELECT AVG(total_score) as avg_score, COUNT(*) as total_exams 
             FROM exam_submissions 
             WHERE student_id = $1 AND status = 'COMPLETED' AND to_char(submitted_at, 'YYYY-MM') = $2`,
            [student_id, month]
        );
        const avgScore = examRes.rows[0]?.avg_score ? parseFloat(examRes.rows[0].avg_score).toFixed(2) : null;
        const totalExams = parseInt(examRes.rows[0]?.total_exams || '0', 10);

        // Lấy dữ liệu topic
        const topicRes = await pool.query(
            `SELECT topic_name, accuracy_rate FROM student_topic_performance WHERE student_id = $1 ORDER BY accuracy_rate DESC`,
            [student_id]
        );
        
        let strongTopics: string[] = [];
        let weakTopics: string[] = [];
        if (topicRes.rows.length > 0) {
            strongTopics = topicRes.rows.filter(t => Number(t.accuracy_rate) >= 80).map(t => t.topic_name);
            weakTopics = topicRes.rows.filter(t => Number(t.accuracy_rate) < 50).map(t => t.topic_name);
        }

        const dataSummary = {
            attendance: { present, absent, late },
            exams: { avgScore, totalExams },
            topics: { strongTopics, weakTopics }
        };

        const prompt = `Bạn là một giáo viên chuyên nghiệp. Dựa vào dữ liệu tháng ${month} của học sinh ${student.full_name}, hãy viết một nhận xét học tập gửi cho phụ huynh.
Quy tắc: 
- Văn phong giáo viên, tích cực, lịch sự, phù hợp với phụ huynh.
- KHÔNG bịa dữ liệu. CHỈ dùng số liệu sau đây:
    + Số buổi học: Có mặt: ${present}, Vắng: ${absent}, Đi trễ: ${late}
    + Kiểm tra: Làm ${totalExams} bài, Điểm trung bình: ${avgScore ? avgScore : 'Chưa có'}
    + Điểm mạnh (chuyên đề tốt): ${strongTopics.length > 0 ? strongTopics.join(', ') : 'Đang cập nhật'}
    + Cần cải thiện (chuyên đề yếu): ${weakTopics.length > 0 ? weakTopics.join(', ') : 'Đang cập nhật'}
    + Mục tiêu học sinh đã đặt: ${student.learning_goals || 'Không có'}
- Nếu không có bài kiểm tra nào, KHÔNG nhắc đến điểm số.
- Phải có: Tóm tắt chung, Điểm mạnh, Cần cải thiện, và Lời khuyên.

Trả về chuỗi văn bản (plain text) có xuống dòng hợp lý, KHÔNG CẦN định dạng JSON hay Markdown phức tạp.`;

        let remarkText = '';
        try {
            remarkText = await generateWithFallback(prompt);
        } catch (aiErr) {
            console.warn("AI generation fallback to rule-based remark:", aiErr);
            remarkText = `Kính gửi Phụ huynh em ${student.full_name},\n\nTrong tháng ${month}, em ${student.full_name} đã tham gia ${present} buổi học (vắng: ${absent} buổi). Em có tinh thần học tập tích cực, tập trung trong giờ học và hoàn thành các nội dung bài học được giao.\n\nGiáo viên khuyến khích em tiếp tục duy trì sự chuyên cần và nỗ lực làm thêm các bài tập rèn luyện để nâng cao kết quả học tập hơn nữa. Trân trọng cảm ơn sự phối hợp từ gia đình!`;
        }
        
        res.status(200).json({ remark: remarkText, data_summary: dataSummary });
    } catch (error) {
        console.error('Lỗi generateRemark:', error);
        res.status(500).json({ message: 'Lỗi server khi tạo nhận xét AI.' });
    }
};

export const getRemark = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { studentId, month } = req.params;

        if (req.user?.role === 'TEACHER') {
            const check = await pool.query(
                `SELECT 1 FROM students s
                 LEFT JOIN enrollments e ON s.id = e.student_id
                 LEFT JOIN classes c ON e.class_id = c.id
                 WHERE s.id = $1 AND (s.teacher_id = $2 OR c.teacher_id = $2)`,
                [studentId, req.user.id]
            );
            if (check.rows.length === 0) {
                res.status(403).json({ message: "Không có quyền xem nhận xét của học sinh này." });
                return;
            }
        }

        const result = await pool.query(
            'SELECT remark_text FROM monthly_student_reports WHERE student_id = $1 AND month = $2',
            [studentId, month]
        );
        if (result.rows.length > 0) {
            res.status(200).json({ remark: result.rows[0].remark_text });
        } else {
            res.status(200).json({ remark: '' });
        }
    } catch (error) {
        console.error('Lỗi getRemark:', error);
        res.status(500).json({ message: 'Lỗi lấy nhận xét.' });
    }
};

export const saveRemark = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { student_id, month, remark_text, data_summary } = req.body;
        
        if (!student_id || !month || !remark_text) {
            res.status(400).json({ message: 'Thiếu thông tin bắt buộc.' });
            return;
        }

        if (req.user?.role === 'TEACHER') {
            const check = await pool.query(
                `SELECT 1 FROM students s
                 LEFT JOIN enrollments e ON s.id = e.student_id
                 LEFT JOIN classes c ON e.class_id = c.id
                 WHERE s.id = $1 AND (s.teacher_id = $2 OR c.teacher_id = $2)`,
                [student_id, req.user.id]
            );
            if (check.rows.length === 0) {
                res.status(403).json({ message: "Không có quyền lưu nhận xét cho học sinh này." });
                return;
            }
        }

        const dataSumJson = data_summary ? JSON.stringify(data_summary) : '{}';
        
        await pool.query(
            `INSERT INTO monthly_student_reports (student_id, month, remark_text, data_summary, edited_by, updated_at) 
             VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
             ON CONFLICT (student_id, month) DO UPDATE SET 
                remark_text = EXCLUDED.remark_text,
                data_summary = EXCLUDED.data_summary,
                edited_by = EXCLUDED.edited_by,
                updated_at = CURRENT_TIMESTAMP`,
            [student_id, month, remark_text, dataSumJson, req.user?.id]
        );
        
        res.status(200).json({ message: 'Đã lưu nhận xét.' });
    } catch (error) {
        console.error('Lỗi saveRemark:', error);
        res.status(500).json({ message: 'Lỗi server khi lưu nhận xét.' });
    }
};

