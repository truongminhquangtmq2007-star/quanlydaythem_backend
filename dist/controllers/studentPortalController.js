"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateEmail = exports.getStudentExams = exports.getDocuments = exports.getSchedule = exports.getDashboard = void 0;
const db_1 = __importDefault(require("../db"));
const getDashboard = async (req, res) => {
    try {
        const studentId = req.user?.student_id;
        if (!studentId) {
            res.status(403).json({ message: 'Không có quyền truy cập Student Portal' });
            return;
        }
        // SCHEMA THẬT: students (id, full_name, phone_number, school_name, ...)
        const profileRes = await db_1.default.query("SELECT id, full_name, email, phone_number AS phone, school_name AS school FROM students WHERE id = $1", [studentId]);
        const profile = { ...profileRes.rows[0], ai_evaluation: null };
        // SCHEMA THẬT: exam_submissions dùng "submitted_at" thay vì "created_at"
        let avgScore = 'Chưa có';
        let examsCount = 0;
        try {
            const examsRes = await db_1.default.query(`SELECT total_score FROM exam_submissions WHERE student_id = $1 AND status = 'COMPLETED' AND submitted_at >= NOW() - INTERVAL '30 days'`, [studentId]);
            if (examsRes.rows.length > 0) {
                avgScore = (examsRes.rows.reduce((sum, e) => sum + Number(e.total_score || 0), 0) / examsRes.rows.length).toFixed(1);
            }
            examsCount = examsRes.rows.length;
        }
        catch (e) {
            console.error("Lỗi lấy điểm:", e);
        }
        // SCHEMA THẬT: attendance dùng "attendance_date" thay vì "date"
        let attendanceRate = 100;
        try {
            const attendanceRes = await db_1.default.query(`SELECT status FROM attendance WHERE student_id = $1 AND attendance_date >= NOW() - INTERVAL '30 days'`, [studentId]);
            const attendances = attendanceRes.rows;
            if (attendances.length > 0) {
                const presentSessions = attendances.filter(a => a.status === 'PRESENT').length;
                attendanceRate = Math.round((presentSessions / attendances.length) * 100);
            }
        }
        catch (e) {
            console.error("Lỗi lấy chuyên cần:", e);
        }
        // Chuyên đề yếu: Lấy từ topic_performance trong exam_submissions (cột JSONB đã được ADD IF NOT EXISTS)
        let weakTopics = [];
        try {
            const topicsRes = await db_1.default.query(`SELECT topic_performance FROM exam_submissions WHERE student_id = $1 AND status = 'COMPLETED' AND topic_performance IS NOT NULL LIMIT 20`, [studentId]);
            if (topicsRes.rows.length > 0) {
                // Tổng hợp từ tất cả bài thi
                const aggregate = {};
                for (const row of topicsRes.rows) {
                    const tp = row.topic_performance;
                    for (const [topic, data] of Object.entries(tp)) {
                        if (!aggregate[topic])
                            aggregate[topic] = { correct: 0, total: 0 };
                        aggregate[topic].correct += data.correct || 0;
                        aggregate[topic].total += data.total || 0;
                    }
                }
                // Tính tỷ lệ và lấy các chuyên đề yếu (< 50%)
                weakTopics = Object.entries(aggregate)
                    .map(([topic, { correct, total }]) => ({
                    topic,
                    accuracy_rate: total > 0 ? Math.round((correct / total) * 100) : 0,
                    correct,
                    total
                }))
                    .filter(t => t.accuracy_rate < 50)
                    .sort((a, b) => a.accuracy_rate - b.accuracy_rate)
                    .slice(0, 3);
            }
        }
        catch (e) {
            console.error("Lỗi lấy chuyên đề yếu:", e);
        }
        // Lịch học sắp tới
        let upcomingSessions = [];
        try {
            const scheduleRes = await db_1.default.query(`SELECT s.id, s.session_date, s.start_time, c.class_name, c.class_type, c.meet_link
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
            console.error(e);
        }
        // Đề thi / Bài tập / Tài liệu được giao
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
            stats: { avgScore, attendanceRate, examsCount },
            weakTopics,
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
        const studentId = req.user?.student_id;
        if (!studentId) {
            res.status(403).json({ message: 'Không có quyền' });
            return;
        }
        const query = `
            SELECT s.id, s.session_date, s.start_time, c.class_name, c.class_type, c.meet_link
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
        const studentId = req.user?.student_id;
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
        const studentId = req.user?.student_id;
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
        const studentId = req.user?.student_id;
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