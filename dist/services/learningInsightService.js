"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateStudentPersonalizedInsight = exports.buildLearningSnapshot = exports.MIN_QUESTIONS_TOPIC = exports.ATTENTION_THRESHOLD = exports.STRONG_THRESHOLD = void 0;
const db_1 = __importDefault(require("../db"));
exports.STRONG_THRESHOLD = 80;
exports.ATTENTION_THRESHOLD = 50;
exports.MIN_QUESTIONS_TOPIC = 5;
const buildLearningSnapshot = async (studentId) => {
    // 1. Student Profile
    const studentRes = await db_1.default.query('SELECT id, full_name, learning_goals FROM students WHERE id = $1', [studentId]);
    const student = studentRes.rows[0];
    // 2. Exam Metrics & Trend
    const examsRes = await db_1.default.query(`
        SELECT total_score, submitted_at 
        FROM exam_submissions 
        WHERE student_id = $1 
        ORDER BY submitted_at DESC 
        LIMIT 6
    `, [studentId]);
    const recentExams = examsRes.rows.slice(0, 3);
    const prevExams = examsRes.rows.slice(3, 6);
    const calcAvg = (exams) => exams.length > 0 ? exams.reduce((s, e) => s + Number(e.total_score), 0) / exams.length : 0;
    const recentAvg = calcAvg(recentExams);
    const prevAvg = calcAvg(prevExams);
    let trend = 'insufficient';
    let delta = null;
    // Yêu cầu tối thiểu 2 bài để tính trend cơ bản, nhưng để chuẩn mực so sánh thì nên dùng 3 vs n
    if (recentExams.length >= 2 && prevExams.length >= 1) {
        delta = recentAvg - prevAvg;
        if (delta >= 2)
            trend = 'improving';
        else if (delta <= -2)
            trend = 'declining';
        else
            trend = 'stable';
    }
    else if (recentExams.length >= 2) {
        // Tính trend nội bộ 2-3 bài gần nhất
        delta = Number(recentExams[0].total_score) - Number(recentExams[recentExams.length - 1].total_score);
        if (delta >= 2)
            trend = 'improving';
        else if (delta <= -2)
            trend = 'declining';
        else
            trend = 'stable';
    }
    // 3. Topic Metrics
    const topicsRes = await db_1.default.query(`
        SELECT topic_name, total_questions, correct_answers, accuracy_rate 
        FROM student_topic_performance 
        WHERE student_id = $1
    `, [studentId]);
    const strengths = [];
    const focusAreas = [];
    topicsRes.rows.forEach(r => {
        if (r.total_questions >= exports.MIN_QUESTIONS_TOPIC) {
            const topicPerf = {
                topic: r.topic_name,
                total_questions: r.total_questions,
                correct_answers: r.correct_answers,
                accuracy: Math.round(r.accuracy_rate)
            };
            if (topicPerf.accuracy >= exports.STRONG_THRESHOLD)
                strengths.push(topicPerf);
            else if (topicPerf.accuracy <= exports.ATTENTION_THRESHOLD)
                focusAreas.push(topicPerf);
        }
    });
    // 4. Attendance
    const attRes = await db_1.default.query(`
        SELECT status FROM attendance WHERE student_id = $1 AND attendance_date >= NOW() - INTERVAL '30 days'
    `, [studentId]);
    const attendanceCount = attRes.rows.length;
    const present = attRes.rows.filter(r => r.status === 'PRESENT').length;
    const absent = attRes.rows.filter(r => r.status === 'ABSENT').length;
    const late = attRes.rows.filter(r => r.status === 'LATE').length;
    const attRate = attendanceCount > 0 ? Math.round((present / attendanceCount) * 100) : 0;
    // 5. Session Metrics
    const sessionRes = await db_1.default.query(`
        SELECT focus_level, teacher_notes FROM session_evaluations 
        WHERE student_id = $1 
        ORDER BY created_at DESC LIMIT 5
    `, [studentId]);
    const notes = sessionRes.rows.map(r => r.teacher_notes).filter(Boolean);
    const avgFocus = sessionRes.rows.length > 0
        ? sessionRes.rows.reduce((s, r) => s + (r.focus_level || 0), 0) / sessionRes.rows.length
        : null;
    // 6. Upcoming Sessions
    const upcomingRes = await db_1.default.query(`
        SELECT s.session_date, c.class_name
        FROM sessions s
        JOIN classes c ON s.class_id = c.id
        JOIN enrollments e ON e.class_id = c.id
        WHERE e.student_id = $1 AND s.session_date > CURRENT_DATE
        ORDER BY s.session_date ASC LIMIT 3
    `, [studentId]);
    // Data Quality logic
    let quality = 'INSUFFICIENT';
    if (recentExams.length >= 1) {
        if (attendanceCount >= 2 && sessionRes.rows.length >= 1) {
            quality = 'FULL';
        }
        else {
            quality = 'PARTIAL';
        }
    }
    return {
        student: { id: student.id, full_name: student.full_name, learning_goals: student.learning_goals },
        period: { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), end: new Date().toISOString() },
        examMetrics: {
            recent: { count: recentExams.length, average: Math.round(recentAvg * 10) / 10 },
            previous: { count: prevExams.length, average: Math.round(prevAvg * 10) / 10 },
            trend,
            delta: delta !== null ? Math.round(delta * 10) / 10 : null
        },
        attendanceMetrics: {
            present, absent, late, rate: attRate,
            status: attendanceCount >= 2 ? 'valid' : 'insufficient'
        },
        topicMetrics: {
            strengths, focusAreas,
            status: topicsRes.rows.length > 0 ? 'valid' : 'insufficient'
        },
        sessionMetrics: {
            focus_level_avg: avgFocus,
            teacher_notes: notes
        },
        upcomingLearning: upcomingRes.rows.map(r => ({
            date: r.session_date.toISOString().split('T')[0],
            class_name: r.class_name
        })),
        dataQuality: quality
    };
};
exports.buildLearningSnapshot = buildLearningSnapshot;
const generateStudentPersonalizedInsight = async (snapshot) => {
    try {
        const studentName = snapshot.student.full_name || 'Học sinh';
        const recentAvg = snapshot.examMetrics.recent.average;
        const trend = snapshot.examMetrics.trend;
        const strengths = snapshot.topicMetrics.strengths.map(s => s.topic).join(', ') || 'Chưa có dữ liệu nổi bật';
        const focusAreas = snapshot.topicMetrics.focusAreas.map(f => f.topic).join(', ') || 'Cần duy trì phong độ';
        const attRate = snapshot.attendanceMetrics.rate;
        return {
            summary: `Đánh giá tổng quan tiến độ của ${studentName}: Điểm trung bình gần đây đạt ${recentAvg}/10 (${trend === 'improving' ? 'đang tiến bộ' : trend === 'declining' ? 'cần chú ý cải thiện' : 'giữ vững phong độ'}). Tỷ lệ chuyên cần đạt ${attRate}%.`,
            strengths: snapshot.topicMetrics.strengths.map(s => `Thế mạnh: ${s.topic} (Độ chính xác: ${s.accuracy}%)`),
            focus_areas: snapshot.topicMetrics.focusAreas.map(f => `Cần luyện thêm: ${f.topic} (Độ chính xác: ${f.accuracy}%)`),
            action_plan: [
                `Duy trì luyện tập các chuyên đề thế mạnh: ${strengths}`,
                `Tập trung làm thêm các dạng bài tập thuộc: ${focusAreas}`,
                `Đảm bảo tham gia đầy đủ các buổi học tiếp theo để bám sát lộ trình`
            ],
            confidence_score: snapshot.dataQuality === 'FULL' ? 0.9 : 0.7
        };
    }
    catch (err) {
        console.error("Lỗi generateStudentPersonalizedInsight:", err);
        throw err;
    }
};
exports.generateStudentPersonalizedInsight = generateStudentPersonalizedInsight;
//# sourceMappingURL=learningInsightService.js.map