"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateEmail = exports.getDocuments = exports.getSchedule = exports.getDashboard = void 0;
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
            const examsRes = await db_1.default.query(`SELECT total_score FROM exam_submissions WHERE student_id = $1 AND submitted_at >= NOW() - INTERVAL '30 days'`, [studentId]);
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
            const topicsRes = await db_1.default.query(`SELECT topic_performance FROM exam_submissions WHERE student_id = $1 AND topic_performance IS NOT NULL LIMIT 20`, [studentId]);
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
            const scheduleRes = await db_1.default.query(`SELECT s.id, s.session_date, s.start_time, c.class_name
                FROM sessions s
                JOIN classes c ON s.class_id = c.id
                JOIN enrollments e ON e.class_id = c.id
                WHERE e.student_id = $1 AND s.session_date >= CURRENT_DATE
                ORDER BY s.session_date ASC, s.start_time ASC
                LIMIT 5`, [studentId]);
            upcomingSessions = scheduleRes.rows;
        }
        catch (e) {
            console.error(e);
        }
        // Đề thi/Bài tập
        let assignments = [];
        try {
            const docsRes = await db_1.default.query(`SELECT d.id, d.title, f.category AS type, c.class_name
  FROM documents d
  JOIN folders f ON d.folder_id = f.id
  JOIN classes c ON f.class_id = c.id
  JOIN enrollments e ON e.class_id = c.id
  WHERE e.student_id = $1
                ORDER BY d.uploaded_at DESC
                LIMIT 5`, [studentId]);
            assignments = docsRes.rows;
        }
        catch (e) {
            console.error(e);
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
        // SCHEMA THẬT: classes dùng "class_name" không phải "name". Không có "subject".
        const query = `
            SELECT s.id, s.session_date, s.start_time, c.class_name
            FROM sessions s
            JOIN classes c ON s.class_id = c.id
            JOIN enrollments e ON e.class_id = c.id
            WHERE e.student_id = $1 AND s.session_date >= CURRENT_DATE
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
        // SCHEMA THẬT: classes dùng "class_name". documents dùng "uploaded_at", "category".
        const query = `
            SELECT d.id, d.title, f.category AS type, d.file_url, d.uploaded_at AS created_at, c.class_name, NULL AS due_at
  FROM documents d
  JOIN folders f ON d.folder_id = f.id
  JOIN classes c ON f.class_id = c.id
  JOIN enrollments e ON e.class_id = c.id
  WHERE e.student_id = $1
            ORDER BY d.uploaded_at DESC
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
const updateEmail = async (req, res) => {
    try {
        const studentId = req.user?.student_id;
        if (!studentId) {
            res.status(403).json({ message: 'Không có quyền' });
            return;
        }
        const { email } = req.body;
        // Basic validation
        if (email && !/^[^s@]+@[^s@]+.[^s@]+$/.test(email)) {
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