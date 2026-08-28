"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWeeklyReport = void 0;
const db_1 = __importDefault(require("../db"));
const aiService_1 = require("../services/ai/aiService");
const getWeeklyReport = async (req, res) => {
    try {
        const { id } = req.params;
        // 1. Thông tin học sinh
        const studentRes = await db_1.default.query(`SELECT full_name, student_code, school, grade, learning_goals FROM students WHERE id = $1`, [id]);
        if (studentRes.rows.length === 0) {
            res.status(404).json({ message: 'Không tìm thấy học sinh' });
            return;
        }
        const student = studentRes.rows[0];
        // Lấy class type
        let classType = 'OFFLINE';
        let meetLink = '';
        const classRes = await db_1.default.query(`SELECT c.class_type, c.meet_link FROM enrollments cm JOIN classes c ON cm.class_id = c.id WHERE cm.student_id = $1 LIMIT 1`, [id]);
        if (classRes.rows.length > 0) {
            classType = classRes.rows[0].class_type;
            meetLink = classRes.rows[0].meet_link || '';
        }
        // 2. Kết quả thi (7 ngày qua)
        const examsRes = await db_1.default.query(`SELECT total_score, created_at 
             FROM exam_submissions 
             WHERE student_id = $1 AND created_at >= NOW() - INTERVAL '7 days'`, [id]);
        const exams = examsRes.rows;
        const avgScore = exams.length > 0
            ? (exams.reduce((sum, e) => sum + Number(e.total_score), 0) / exams.length).toFixed(1)
            : '0';
        // 3. Chuyên cần (7 ngày qua)
        const attendanceRes = await db_1.default.query(`SELECT status 
             FROM attendance 
             WHERE student_id = $1 AND date >= NOW() - INTERVAL '7 days'`, [id]);
        const attendances = attendanceRes.rows;
        const totalSessions = attendances.length;
        const presentSessions = attendances.filter(a => a.status === 'PRESENT').length;
        const attendanceRate = totalSessions > 0 ? Math.round((presentSessions / totalSessions) * 100) : 100;
        // 4. Phân tích chuyên đề (Tất cả hoặc tuần qua - ta lấy tổng quan để báo cáo)
        const topicsRes = await db_1.default.query(`SELECT topic, accuracy_rate 
             FROM student_topic_performance 
             WHERE student_id = $1 
             ORDER BY accuracy_rate DESC`, [id]);
        const topics = topicsRes.rows;
        const strongTopics = topics.filter(t => Number(t.accuracy_rate) >= 80).map(t => t.topic);
        const weakTopics = topics.filter(t => Number(t.accuracy_rate) < 50).map(t => t.topic);
        let classTypeContext = classType === 'ONLINE'
            ? `Đây là lớp học ONLINE. Báo cáo hãy đánh giá sự tập trung học từ xa, khả năng hoàn thành bài qua link số. (Meet Link: ${meetLink})`
            : `Đây là lớp học OFFLINE. Báo cáo hãy đánh giá sự chú ý trên lớp, và tinh thần tương tác trực tiếp.`;
        // Chuẩn bị dữ liệu cho AI
        const promptData = `
Tên học sinh: ${student.full_name}
Mục tiêu ngắn hạn: ${student.learning_goals || 'Chưa có'}
Số bài thi tuần qua: ${exams.length}
Điểm trung bình: ${avgScore}/10
Tỉ lệ chuyên cần: ${attendanceRate}% (${presentSessions}/${totalSessions} buổi)
Chuyên đề tốt (Mastery): ${strongTopics.join(', ') || 'Chưa có'}
Chuyên đề yếu cần cải thiện: ${weakTopics.join(', ') || 'Chưa có'}
Hình thức lớp: ${classTypeContext}
`;
        const prompt = `Bạn là Huấn luyện viên đào tạo (Coach Mode). Hãy viết "Nhật ký đào tạo hiệu năng cao" (Weekly Report) gửi phụ huynh về tình hình học tập tuần qua của học viên ${student.full_name}.
Dữ liệu:
${promptData}

Yêu cầu:
1. Dùng giọng văn mạnh mẽ, truyền cảm hứng, tập trung vào Topic Mastery (sự làm chủ chuyên đề) và thái độ chủ động của học viên.
2. Đánh giá dựa trên Hình thức lớp học (Online/Offline) và liên kết với Mục tiêu ngắn hạn.
3. Chỉ ra sự tiến bộ và đưa ra 1-2 chiến thuật cụ thể để cải thiện điểm yếu.
4. Ngắn gọn trong vòng 150 - 250 từ. Trình bày bằng Markdown chuyên nghiệp, có highlight bôi đậm.`;
        // Gọi AI
        const aiReport = await (0, aiService_1.explainErrorWithAI)(prompt);
        res.status(200).json({
            student,
            stats: {
                exams_count: exams.length,
                avg_score: avgScore,
                attendance_rate: attendanceRate,
                topics
            },
            ai_report: aiReport
        });
    }
    catch (error) {
        console.error('Lỗi generate weekly report:', error);
        res.status(500).json({ message: 'Lỗi server khi tạo báo cáo' });
    }
};
exports.getWeeklyReport = getWeeklyReport;
//# sourceMappingURL=reportController.js.map