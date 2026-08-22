import { Response } from 'express';
import pool from '../db';
import { AuthRequest } from '../middleware/authMiddleware';

export const getDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const studentId = req.user?.student_id;
        if (!studentId) {
            res.status(403).json({ message: 'Không có quyền truy cập Student Portal' });
            return;
        }

        // Lấy thông tin cá nhân (Sửa lại chỉ lấy cột có thực)
        const profileRes = await pool.query('SELECT id, full_name, phone_number, school FROM students WHERE id = $1', [studentId]);
        const profile = profileRes.rows[0];

        // Điểm trung bình (7 ngày qua) -> sửa thành bảng bài tập hoặc điểm (nếu có)
        // Hiện tại cứ query từ exam_submissions
        let avgScore = 'Chưa có';
        let examsCount = 0;
        try {
            const examsRes = await pool.query(`SELECT total_score FROM exam_submissions WHERE student_id = $1 AND created_at >= NOW() - INTERVAL '30 days'`, [studentId]);
            if (examsRes.rows.length > 0) {
                avgScore = (examsRes.rows.reduce((sum, e) => sum + Number(e.total_score || 0), 0) / examsRes.rows.length).toFixed(1);
            }
            examsCount = examsRes.rows.length;
        } catch(e) { console.error("Lỗi lấy điểm", e); }

        // Tỷ lệ chuyên cần (30 ngày qua)
        let attendanceRate = 100;
        try {
            const attendanceRes = await pool.query(`SELECT status FROM attendance WHERE student_id = $1 AND date >= NOW() - INTERVAL '30 days'`, [studentId]);
            const attendances = attendanceRes.rows;
            if (attendances.length > 0) {
                const presentSessions = attendances.filter(a => a.status === 'PRESENT').length;
                attendanceRate = Math.round((presentSessions / attendances.length) * 100);
            }
        } catch(e) { console.error("Lỗi lấy chuyên cần", e); }

        // Chuyên đề yếu
        let weakTopics: any[] = [];
        try {
            const topicsRes = await pool.query(`SELECT topic, accuracy_rate FROM student_topic_performance WHERE student_id = $1 ORDER BY accuracy_rate ASC LIMIT 5`, [studentId]);
            weakTopics = topicsRes.rows;
        } catch(e) { console.error("Lỗi lấy chuyên đề yếu", e); }

        res.status(200).json({
            profile,
            stats: { avgScore, attendanceRate, examsCount },
            weakTopics
        });
    } catch (error) {
        console.error("LỖI getDashboard:", error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

export const getSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const studentId = req.user?.student_id;
        if (!studentId) {
            res.status(403).json({ message: 'Không có quyền' });
            return;
        }

        // Sửa query bảng sessions thay vì class_members thành enrollments
        const query = `
            SELECT s.id, s.session_date, s.start_time, s.end_time, c.name as class_name, c.subject
            FROM sessions s
            JOIN classes c ON s.class_id = c.id
            JOIN enrollments e ON e.class_id = c.id
            WHERE e.student_id = $1 AND s.session_date >= CURRENT_DATE
            ORDER BY s.session_date ASC, s.start_time ASC
            LIMIT 10
        `;
        console.log("Query Lịch:", query);
        const result = await pool.query(query, [studentId]);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("LỖI getSchedule:", error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

export const getDocuments = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const studentId = req.user?.student_id;
        if (!studentId) {
            res.status(403).json({ message: 'Không có quyền' });
            return;
        }

        // Truy vấn từ bảng documents, join enrollments
        const query = `
            SELECT d.id, d.title, d.type, d.file_url, d.created_at, c.name as class_name
            FROM documents d
            JOIN classes c ON d.class_id = c.id
            JOIN enrollments e ON e.class_id = c.id
            WHERE e.student_id = $1
            ORDER BY d.created_at DESC
        `;
        console.log("Query Tài Liệu:", query);
        const result = await pool.query(query, [studentId]);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("LỖI getDocuments:", error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};
