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

        // Bỏ cột grade mock, chỉ lấy các cột thực tế
        const profileRes = await pool.query(
            "SELECT id, full_name, phone_number AS phone, school_name AS school FROM students WHERE id = $1", 
            [studentId]
        );
        const profile = profileRes.rows[0];

        let avgScore = 'Chưa có';
        let examsCount = 0;
        try {
            const examsRes = await pool.query(`SELECT total_score FROM exam_submissions WHERE student_id = $1 AND created_at >= NOW() - INTERVAL '30 days'`, [studentId]);
            if (examsRes.rows.length > 0) {
                avgScore = (examsRes.rows.reduce((sum, e) => sum + Number(e.total_score || 0), 0) / examsRes.rows.length).toFixed(1);
            }
            examsCount = examsRes.rows.length;
        } catch(e) { console.error("Lỗi lấy điểm:", e); }

        let attendanceRate = 100;
        try {
            const attendanceRes = await pool.query(`SELECT status FROM attendance WHERE student_id = $1 AND date >= NOW() - INTERVAL '30 days'`, [studentId]);
            const attendances = attendanceRes.rows;
            if (attendances.length > 0) {
                const presentSessions = attendances.filter(a => a.status === 'PRESENT').length;
                attendanceRate = Math.round((presentSessions / attendances.length) * 100);
            }
        } catch(e) { console.error("Lỗi lấy chuyên cần:", e); }

        let weakTopics: any[] = [];
        try {
            const topicsRes = await pool.query(`SELECT topic, accuracy_rate FROM student_topic_performance WHERE student_id = $1 ORDER BY accuracy_rate ASC LIMIT 5`, [studentId]);
            weakTopics = topicsRes.rows;
        } catch(e) { console.error("Lỗi lấy chuyên đề yếu:", e); }

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

        // Bỏ end_time giả mạo, chỉ lấy start_time
        const query = `
            SELECT s.id, s.session_date, s.start_time, c.name as class_name, c.subject
            FROM sessions s
            JOIN classes c ON s.class_id = c.id
            JOIN enrollments e ON e.class_id = c.id
            WHERE e.student_id = $1 AND s.session_date >= CURRENT_DATE
            ORDER BY s.session_date ASC, s.start_time ASC
            LIMIT 10
        `;
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

        // Đã cập nhật database: documents có class_id.
        // Chỉ lấy tài liệu được gán cho lớp của học sinh đó.
        const query = `
            SELECT d.id, d.title, d.category AS type, d.file_url, d.uploaded_at AS created_at, c.name as class_name, NULL AS due_at
            FROM documents d
            JOIN classes c ON d.class_id = c.id
            JOIN enrollments e ON e.class_id = c.id
            WHERE e.student_id = $1 AND d.class_id IS NOT NULL
            ORDER BY d.uploaded_at DESC
            LIMIT 20
        `;
        const result = await pool.query(query, [studentId]);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("LỖI getDocuments:", error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};
