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
        const qRes = await pool.query(`SELECT quiz_id, content, answer_data, question_type FROM questions WHERE id = $1`, [question_id]);
        if (qRes.rows.length === 0) {
            res.status(404).json({ message: 'Không tìm thấy câu hỏi' });
            return;
        }
        
        const questionRow = qRes.rows[0];
        const documentId = questionRow.quiz_id;

        // BẮT BUỘC KIỂM TRA QUYỀN TRUY CẬP ĐÁP ÁN (BẢO MẬT)
        const keyRes = await pool.query(`SELECT allow_view_answers FROM exam_keys WHERE document_id = $1`, [documentId]);
        if (keyRes.rows.length === 0 || !keyRes.rows[0].allow_view_answers) {
            res.status(403).json({ message: 'Giáo viên chưa cho phép xem đáp án và giải thích cho bài thi này.' });
            return;
        }

        let questionContent = questionRow.content;
        // Parse content if it's JSON
        let parsedContent: any = {};
        try {
            parsedContent = typeof questionContent === 'string' ? JSON.parse(questionContent) : questionContent;
        } catch (e) {
            parsedContent = { questionText: questionContent };
        }

        const questionText = parsedContent.questionText || questionContent;
        const shareContext = parsedContent.shareContext || '';
        const questionType = questionRow.question_type;

        let correctAnswerText = 'Không tìm thấy';
        try {
            const parsedAns = typeof questionRow.answer_data === 'string' ? JSON.parse(questionRow.answer_data) : questionRow.answer_data;
            correctAnswerText = typeof parsedAns === 'object' ? JSON.stringify(parsedAns) : String(parsedAns);
        } catch (e) {
            correctAnswerText = String(questionRow.answer_data);
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
            ? 'Lưu ý: Học sinh đang học Online. Nhắc nhở tập trung nếu cần.' 
            : 'Lưu ý: Học sinh đang học Offline. Khuyến khích tương tác trực tiếp.';

        const prompt = `Học sinh làm sai câu hỏi sau:
Loại câu hỏi: ${questionType}
${shareContext ? 'Ngữ cảnh chung: ' + shareContext + '\n' : ''}Nội dung câu hỏi: ${questionText}
Đáp án đúng là: ${correctAnswerText}
Học sinh đã chọn/trả lời: ${student_answer}

Đóng vai Huấn luyện viên cá nhân (Coach Mode), KHÔNG giải đáp thẳng mà:
1. Giải thích vì sao đáp án đúng.
2. Chỉ ra lỗi sai hoặc sự nhầm lẫn trong câu trả lời của học sinh.
3. Dùng phương pháp Socrates, gợi mở tư duy.
4. Dùng định dạng Markdown và bọc công thức Toán học bằng $ hoặc $$. Không bịa dữ liệu, không chẩn đoán tâm lý.
5. Văn phong dễ hiểu, gần gũi với học sinh.

Bối cảnh học sinh:
- Mục tiêu ngắn hạn: ${learningGoals}
- Hình thức học: ${classTypeContext}`;

        const explanation = await generateWithFallback(prompt);
        res.status(200).json({ explanation });
    } catch (error) {
        console.error('Lỗi explainError controller:', error);
        res.status(500).json({ message: 'Lỗi server khi nhờ AI giải thích' });
    }
};

export const generateRemark = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { student_id, month, bill_id } = req.body;

        if (!student_id || !month) {
            res.status(400).json({ message: 'Thiếu student_id hoặc month.' });
            return;
        }

        const studentRes = await pool.query('SELECT full_name, learning_goals FROM students WHERE id = $1', [student_id]);
        if (studentRes.rows.length === 0) {
            res.status(404).json({ message: 'Không tìm thấy học sinh.' });
            return;
        }
        const student = studentRes.rows[0];

        // Tìm tuition_bill
        let startDate = null;
        let endDate = null;

        if (bill_id) {
            const billRes = await pool.query('SELECT start_date, end_date FROM tuition_bills WHERE id = $1 AND student_id = $2', [bill_id, student_id]);
            if (billRes.rows.length > 0) {
                startDate = billRes.rows[0].start_date;
                endDate = billRes.rows[0].end_date;
            }
        }

        // Nếu không có bill_id, dùng month mặc định
        const dateFilter = (startDate && endDate) 
            ? `AND date >= $2 AND date <= $3`
            : `AND to_char(date, 'YYYY-MM') = $2`;

        const queryParamsAtt = (startDate && endDate) ? [student_id, startDate, endDate] : [student_id, month];

        // 1. Attendance
        const attendanceRes = await pool.query(
            `SELECT status, COUNT(*) as count FROM attendance 
             WHERE student_id = $1 ${dateFilter}
             GROUP BY status`, 
            queryParamsAtt
        );
        let present = 0, absent = 0, late = 0;
        attendanceRes.rows.forEach(r => {
            if (r.status === 'PRESENT') present = parseInt(r.count, 10);
            if (r.status === 'ABSENT') absent = parseInt(r.count, 10);
            if (r.status === 'LATE') late = parseInt(r.count, 10);
        });

        // 2. Lấy Session Evaluations (Ghi chú giáo viên)
        const sessionEvalFilter = (startDate && endDate) 
            ? `AND s.session_date >= $2 AND s.session_date <= $3`
            : `AND to_char(s.session_date, 'YYYY-MM') = $2`;
        const evalParams = (startDate && endDate) ? [student_id, startDate, endDate] : [student_id, month];

        const evalRes = await pool.query(
            `SELECT s.session_date, se.evaluation_text 
             FROM session_evaluations se
             JOIN sessions s ON se.session_id = s.id
             WHERE se.student_id = $1 ${sessionEvalFilter}`,
            evalParams
        );
        let evaluationSummary = evalRes.rows.map(r => `${new Date(r.session_date).toLocaleDateString('vi-VN')}: ${r.evaluation_text}`).join('\n');

        // 3. Exams
        const examFilter = (startDate && endDate) 
            ? `AND submitted_at >= $2 AND submitted_at <= $3`
            : `AND to_char(submitted_at, 'YYYY-MM') = $2`;
        const queryParamsExam = (startDate && endDate) ? [student_id, startDate, endDate] : [student_id, month];

        const examRes = await pool.query(
            `SELECT AVG(total_score) as avg_score, COUNT(*) as total_exams 
             FROM exam_submissions 
             WHERE student_id = $1 ${examFilter}`,
            queryParamsExam
        );
        const avgScore = examRes.rows[0].avg_score ? parseFloat(examRes.rows[0].avg_score).toFixed(2) : null;
        const totalExams = parseInt(examRes.rows[0].total_exams, 10);

        // 4. Topic Performance
        const topicRes = await pool.query(
            `SELECT topic_name, accuracy_rate FROM student_topic_performance WHERE student_id = $1 ORDER BY accuracy_rate DESC LIMIT 20`,
            [student_id]
        );
        
        let strongTopics = [];
        let weakTopics = [];
        if (topicRes.rows.length > 0) {
            strongTopics = topicRes.rows.filter(t => Number(t.accuracy_rate) >= 80).map(t => t.topic_name);
            weakTopics = topicRes.rows.filter(t => Number(t.accuracy_rate) < 50).map(t => t.topic_name);
        }

        // 5. Future Sessions
        let upcomingSessions = '';
        const futureRes = await pool.query(
            `SELECT s.session_date, s.content, c.class_name
             FROM sessions s
             JOIN enrollments e ON s.class_id = e.class_id
             JOIN classes c ON s.class_id = c.id
             WHERE e.student_id = $1 AND s.session_date > CURRENT_DATE
             ORDER BY s.session_date ASC LIMIT 2`,
            [student_id]
        );
        if (futureRes.rows.length > 0) {
            upcomingSessions = futureRes.rows.map(r => `${new Date(r.session_date).toLocaleDateString('vi-VN')}: ${r.class_name} - ${r.content || 'Đang cập nhật'}`).join(', ');
        }

        // 6. Previous Period Data
        let prevAvgScore = null;
        let prevPresent = null;
        if (startDate && endDate) {
            const prevBillRes = await pool.query(
                `SELECT start_date, end_date FROM tuition_bills
                 WHERE student_id = $1 AND start_date < $2
                 ORDER BY start_date DESC LIMIT 1`,
                [student_id, startDate]
            );
            if (prevBillRes.rows.length > 0) {
                const prevStart = prevBillRes.rows[0].start_date;
                const prevEnd = prevBillRes.rows[0].end_date;

                const pExam = await pool.query(
                    `SELECT AVG(total_score) as avg_score FROM exam_submissions
                     WHERE student_id = $1 AND submitted_at >= $2 AND submitted_at <= $3`,
                    [student_id, prevStart, prevEnd]
                );
                prevAvgScore = pExam.rows[0].avg_score ? parseFloat(pExam.rows[0].avg_score).toFixed(2) : null;

                const pAtt = await pool.query(
                    `SELECT COUNT(*) as count FROM attendance
                     WHERE student_id = $1 AND status = 'PRESENT' AND attendance_date >= $2 AND attendance_date <= $3`,
                    [student_id, prevStart, prevEnd]
                );
                prevPresent = parseInt(pAtt.rows[0].count, 10) || 0;
            }
        }

        const dataSummary = {
            attendance: { present, absent, late },
            exams: { avgScore, totalExams },
            topics: { strongTopics, weakTopics }
        };

        const prompt = `Bạn là một giáo viên chuyên nghiệp. Dựa vào dữ liệu kỳ học phí tháng ${month} của học sinh ${student.full_name}, hãy viết một nhận xét học tập gửi cho phụ huynh.
Quy tắc:
- KHÔNG CẦN định dạng JSON hay Markdown phức tạp, trình bày plain text sạch sẽ.
- CHỈ được nhận xét dựa trên dữ liệu được cung cấp dưới đây. KHÔNG bịa điểm, KHÔNG bịa buổi học.
- Nếu không có dữ liệu cho một mục, hãy nói "Chưa đủ dữ liệu để phân tích".
- AI phải phân biệt: Current month evidence vs Overall/cumulative trend.
- Chỉ dùng cumulative topic performance để bổ trợ nhận định tổng thể.

DỮ LIỆU KỲ NÀY (FACTS):
- Số buổi học: Có mặt ${present}, Vắng ${absent}, Đi trễ ${late}
- Điểm kiểm tra kỳ này: Làm ${totalExams} bài, Trung bình: ${avgScore ? avgScore : 'Chưa có'}
- Ghi chú buổi học từ giáo viên: ${evaluationSummary ? '\n' + evaluationSummary : 'Không có chi tiết từng buổi'}

SO SÁNH VỚI KỲ TRƯỚC (NẾU CÓ):
${prevPresent !== null ? `- Số buổi có mặt kỳ trước: ${prevPresent}` : '- Không có dữ liệu chuyên cần kỳ trước'}
${prevAvgScore !== null ? `- Điểm trung bình kỳ trước: ${prevAvgScore}` : '- Không có điểm kỳ trước'}

XU HƯỚNG TỔNG THỂ (CUMULATIVE TRENDS):
- Chuyên đề thế mạnh: ${strongTopics.length > 0 ? strongTopics.join(', ') : 'Chưa có dữ liệu'}
- Chuyên đề cần cải thiện: ${weakTopics.length > 0 ? weakTopics.join(', ') : 'Chưa có dữ liệu'}
- Mục tiêu tổng thể: ${student.learning_goals || 'Không có'}

ĐỊNH HƯỚNG SẮP TỚI:
${upcomingSessions ? `- Các buổi học sắp tới: ${upcomingSessions}` : '- Chưa có lịch học cụ thể cho kỳ tới'}

Yêu cầu cấu trúc đầu ra:
1. Tóm tắt chung kỳ này
2. Điểm sáng / Tiến bộ (So sánh kỳ trước nếu có)
3. Điểm cần cải thiện
4. Định hướng kỳ tiếp theo (Dựa vào "Các buổi học sắp tới" ở trên)
5. Lời nhắn nhủ phụ huynh`;

        const remarkText = await generateWithFallback(prompt);

        res.status(200).json({ remark: remarkText, data_summary: dataSummary });
    } catch (error) {
        console.error('Lỗi generateRemark:', error);
        res.status(500).json({ message: 'Lỗi server khi tạo nhận xét AI.' });
    }
};

export const getRemark = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { studentId, month } = req.params;
        if (!studentId || !month) {
            res.status(400).json({ message: 'Thiếu thông tin.' });
            return;
        }

        const result = await pool.query(
            'SELECT remark_text, data_summary FROM monthly_student_reports WHERE student_id = $1 AND month = $2',
            [studentId, month]
        );

        if (result.rows.length > 0) {
            res.status(200).json({ remark: result.rows[0].remark_text, data_summary: result.rows[0].data_summary });
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

        const edited_by = req.user?.id || null;

        await pool.query(
            `INSERT INTO monthly_student_reports (student_id, month, remark_text, data_summary, edited_by) 
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (student_id, month) 
             DO UPDATE SET 
                remark_text = EXCLUDED.remark_text, 
                data_summary = EXCLUDED.data_summary, 
                edited_by = EXCLUDED.edited_by,
                updated_at = NOW()`,
            [student_id, month, remark_text, data_summary || null, edited_by]
        );

        res.status(200).json({ message: 'Đã lưu nhận xét.' });
    } catch (error) {
        console.error('Lỗi saveRemark:', error);
        res.status(500).json({ message: 'Lỗi server khi lưu nhận xét.' });
    }
};
