"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateEmail = exports.getStudentExams = exports.getDocuments = exports.getSchedule = exports.getDashboard = void 0;
const db_1 = __importDefault(require("../db"));
const examController_1 = require("./examController");
const getDashboard = async (req, res) => {
    try {
        const studentId = await (0, examController_1.resolveCanonicalStudentId)(req.user);
        if (!studentId) {
            res.status(403).json({ message: 'Không có quyền truy cập Student Portal hoặc tài khoản chưa liên kết hồ sơ học sinh.' });
            return;
        }
        // 1. Hồ sơ học sinh
        const profileRes = await db_1.default.query("SELECT id, full_name, email, phone_number AS phone, school_name AS school, learning_goals FROM students WHERE id = $1", [studentId]);
        const profile = profileRes.rows[0] ? { ...profileRes.rows[0], ai_evaluation: null } : null;
        // 2. Điểm thi (Chỉ tính các bài thi đã COMPLETED)
        let avgScore = 'Chưa có';
        let examsCount = 0;
        let recentScores = [];
        try {
            const examsRes = await db_1.default.query(`SELECT id, document_id, total_score, submitted_at 
                 FROM exam_submissions 
                 WHERE student_id = $1 AND status = 'COMPLETED'
                 ORDER BY submitted_at DESC 
                 LIMIT 10`, [studentId]);
            examsCount = examsRes.rows.length;
            if (examsCount > 0) {
                const total = examsRes.rows.reduce((sum, e) => sum + Number(e.total_score || 0), 0);
                avgScore = (total / examsCount).toFixed(1);
                recentScores = examsRes.rows.map(e => ({
                    id: e.id,
                    document_id: e.document_id,
                    total_score: Number(e.total_score),
                    submitted_at: e.submitted_at ? new Date(e.submitted_at).toISOString() : new Date().toISOString()
                }));
            }
        }
        catch (e) {
            console.error("Lỗi lấy điểm bài thi:", e);
        }
        // 3. Chuyên cần (30 ngày gần nhất)
        let attendanceRate = 100;
        try {
            const attendanceRes = await db_1.default.query(`SELECT status FROM attendance WHERE student_id = $1 AND attendance_date >= CURRENT_DATE - INTERVAL '30 days'`, [studentId]);
            const attendances = attendanceRes.rows;
            if (attendances.length > 0) {
                const presentSessions = attendances.filter(a => a.status === 'PRESENT' || a.status === 'Có mặt').length;
                attendanceRate = Math.round((presentSessions / attendances.length) * 100);
            }
        }
        catch (e) {
            console.error("Lỗi lấy chuyên cần:", e);
        }
        // 4. Phân tích chuyên đề (Ưu tiên bảng canonical student_topic_performance)
        let weakTopics = [];
        let strongTopics = [];
        let allTopics = [];
        try {
            const topicsRes = await db_1.default.query(`SELECT 
                    TRIM(topic_name) as topic_name, 
                    SUM(total_questions)::int as total_questions, 
                    SUM(correct_answers)::int as correct_answers,
                    ROUND(CAST(SUM(correct_answers) AS NUMERIC) * 100.0 / NULLIF(SUM(total_questions), 0), 1) as accuracy_rate
                 FROM student_topic_performance 
                 WHERE student_id = $1 
                 GROUP BY TRIM(topic_name)
                 HAVING SUM(total_questions) > 0
                 ORDER BY accuracy_rate DESC, total_questions DESC`, [studentId]);
            let rawTopics = topicsRes.rows;
            // Fallback nếu student_topic_performance rỗng: đọc JSONB từ completed submissions
            if (rawTopics.length === 0) {
                const jsonbRes = await db_1.default.query(`SELECT topic_performance FROM exam_submissions WHERE student_id = $1 AND status = 'COMPLETED' AND topic_performance IS NOT NULL LIMIT 20`, [studentId]);
                if (jsonbRes.rows.length > 0) {
                    const aggregate = {};
                    for (const row of jsonbRes.rows) {
                        const tp = row.topic_performance;
                        for (const [topic, data] of Object.entries(tp || {})) {
                            const cleanTopic = String(topic).trim();
                            if (!aggregate[cleanTopic])
                                aggregate[cleanTopic] = { correct: 0, total: 0 };
                            aggregate[cleanTopic].correct += Number(data.correct || data.corrects || 0);
                            aggregate[cleanTopic].total += Number(data.total || data.attempts || 0);
                        }
                    }
                    rawTopics = Object.entries(aggregate).map(([topic_name, stats]) => ({
                        topic_name,
                        total_questions: stats.total,
                        correct_answers: stats.correct,
                        accuracy_rate: stats.total > 0 ? Math.round((stats.correct / stats.total) * 1000) / 10 : 0
                    }));
                }
            }
            allTopics = rawTopics.map(t => ({
                topic: t.topic_name,
                total_questions: Number(t.total_questions || 0),
                correct_answers: Number(t.correct_answers || 0),
                accuracy_rate: Math.round(Number(t.accuracy_rate || 0))
            }));
            // Chuyên đề yếu (< 50%) và Chuyên đề mạnh (>= 80%)
            weakTopics = allTopics
                .filter(t => t.accuracy_rate < 50)
                .sort((a, b) => a.accuracy_rate - b.accuracy_rate);
            strongTopics = allTopics
                .filter(t => t.accuracy_rate >= 80)
                .sort((a, b) => b.accuracy_rate - a.accuracy_rate);
        }
        catch (e) {
            console.error("Lỗi lấy chuyên đề:", e);
        }
        // 5. AI Insight mới nhất nếu có
        let aiInsight = null;
        try {
            const insightRes = await db_1.default.query(`SELECT payload, generated_at, expires_at 
                 FROM student_ai_insights 
                 WHERE student_id = $1 AND insight_type = 'CURRENT_PROGRESS'`, [studentId]);
            if (insightRes.rows.length > 0) {
                aiInsight = {
                    ...insightRes.rows[0].payload,
                    generated_at: insightRes.rows[0].generated_at,
                    expires_at: insightRes.rows[0].expires_at
                };
            }
        }
        catch (e) {
            console.error("Lỗi lấy AI insight:", e);
        }
        // 6. Lịch học sắp tới
        let upcomingSessions = [];
        try {
            const scheduleRes = await db_1.default.query(`SELECT DISTINCT s.id, s.session_date, s.start_time, c.class_name, c.class_type, c.meet_link
                FROM sessions s
                JOIN classes c ON s.class_id = c.id
                JOIN enrollments e ON e.class_id = c.id
                WHERE e.student_id = $1 
                  AND (e.status IS NULL OR e.status = 'ACTIVE' OR e.status = 'Đang học')
                  AND s.session_date >= CURRENT_DATE
                ORDER BY s.session_date ASC, s.start_time ASC
                LIMIT 5`, [studentId]);
            upcomingSessions = scheduleRes.rows;
        }
        catch (e) {
            console.error("Lỗi lấy lịch học:", e);
        }
        // 7. Đề thi / Bài tập / Tài liệu được giao
        let assignments = [];
        try {
            const docsRes = await db_1.default.query(`SELECT a.id as assignment_id, d.id as document_id, COALESCE(a.title, d.title) as title, 
                        d.file_url, d.category as type, c.class_name, a.due_at, a.description as session_info,
                        a.created_at
                 FROM assignments a
                 JOIN documents d ON a.document_id = d.id
                 JOIN classes c ON a.class_id = c.id
                 JOIN enrollments e ON e.class_id = c.id
                 WHERE e.student_id = $1 AND (e.status IS NULL OR e.status = 'ACTIVE' OR e.status = 'Đang học')
                 ORDER BY a.created_at DESC
                 LIMIT 5`, [studentId]);
            assignments = docsRes.rows;
        }
        catch (e) {
            console.error("Lỗi lấy assignments:", e);
        }
        res.status(200).json({
            profile,
            stats: {
                avgScore,
                attendanceRate,
                examsCount,
                recentScores
            },
            weakTopics,
            strongTopics,
            allTopics,
            aiInsight,
            upcomingSessions,
            assignments
        });
    }
    catch (error) {
        console.error("LỖI getDashboard:", error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};
exports.getDashboard = getDashboard;
const getSchedule = async (req, res) => {
    try {
        const studentId = await (0, examController_1.resolveCanonicalStudentId)(req.user);
        if (!studentId) {
            res.status(403).json({ message: 'Không có quyền' });
            return;
        }
        const query = `
            SELECT DISTINCT s.id, s.session_date, s.start_time, c.class_name, c.class_type, c.meet_link
            FROM sessions s
            JOIN classes c ON s.class_id = c.id
            JOIN enrollments e ON e.class_id = c.id
            WHERE e.student_id = $1 
              AND (e.status IS NULL OR e.status = 'ACTIVE' OR e.status = 'Đang học')
              AND s.session_date >= CURRENT_DATE
            ORDER BY s.session_date ASC, s.start_time ASC
            LIMIT 10
        `;
        const result = await db_1.default.query(query, [studentId]);
        res.status(200).json(result.rows);
    }
    catch (error) {
        console.error("LỖI getSchedule:", error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};
exports.getSchedule = getSchedule;
const getDocuments = async (req, res) => {
    try {
        const studentId = await (0, examController_1.resolveCanonicalStudentId)(req.user);
        if (!studentId) {
            res.status(403).json({ message: 'Không có quyền' });
            return;
        }
        const query = `
            SELECT a.id, COALESCE(a.title, d.title) as title, d.category AS type, d.file_url,
                   a.created_at, c.class_name, a.due_at, a.description as session_info
            FROM assignments a
            JOIN documents d ON a.document_id = d.id
            JOIN classes c ON a.class_id = c.id
            JOIN enrollments e ON e.class_id = c.id
            WHERE e.student_id = $1 AND (e.status IS NULL OR e.status = 'ACTIVE' OR e.status = 'Đang học')
            ORDER BY a.created_at DESC
            LIMIT 20
        `;
        const result = await db_1.default.query(query, [studentId]);
        res.status(200).json(result.rows);
    }
    catch (error) {
        console.error("LỖI getDocuments:", error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};
exports.getDocuments = getDocuments;
const getStudentExams = async (req, res) => {
    try {
        const studentId = await (0, examController_1.resolveCanonicalStudentId)(req.user);
        if (!studentId) {
            res.status(403).json({ message: 'Không có quyền' });
            return;
        }
        const query = `
            SELECT DISTINCT d.id, d.title, d.file_url, d.category, d.uploaded_at as created_at,
                   COALESCE(c.class_name, 'Luyện thi') as class_name, 
                   COALESCE(ek.duration_minutes, 50) as duration_minutes, 
                   COALESCE(ek.allow_view_answers, true) as allow_view_answers
            FROM documents d
            LEFT JOIN exam_keys ek ON ek.document_id = d.id
            LEFT JOIN folders f ON d.folder_id = f.id
            LEFT JOIN classes c ON (d.class_id = c.id OR ek.class_id = c.id OR f.class_id = c.id OR (d.class_id IS NULL AND ek.class_id IS NULL AND f.class_id IS NULL AND c.teacher_id = d.teacher_id))
            JOIN enrollments e ON e.class_id = c.id
            WHERE e.student_id = $1 
              AND (e.status IS NULL OR e.status = 'ACTIVE' OR e.status = 'Đang học')
              AND (d.category = 'EXAM' OR ek.document_id IS NOT NULL)
            ORDER BY d.uploaded_at DESC
        `;
        const result = await db_1.default.query(query, [studentId]);
        res.status(200).json(result.rows);
    }
    catch (error) {
        console.error("LỖI getStudentExams:", error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};
exports.getStudentExams = getStudentExams;
const updateEmail = async (req, res) => {
    try {
        const studentId = await (0, examController_1.resolveCanonicalStudentId)(req.user);
        if (!studentId) {
            res.status(403).json({ message: 'Không có quyền' });
            return;
        }
        const { email } = req.body;
        // Basic validation
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            res.status(400).json({ message: 'Email không hợp lệ' });
            return;
        }
        await db_1.default.query('UPDATE students SET email = $1 WHERE id = $2', [email || null, studentId]);
        res.status(200).json({ message: 'Cập nhật email thành công' });
    }
    catch (error) {
        console.error("LỖI updateEmail:", error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};
exports.updateEmail = updateEmail;
//# sourceMappingURL=studentPortalController.js.map