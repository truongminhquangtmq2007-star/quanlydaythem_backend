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

        // Lấy thông tin cá nhân
        const profileRes = await pool.query('SELECT full_name, student_code, school, grade FROM students WHERE id = $1', [studentId]);
        const profile = profileRes.rows[0];

        // Điểm trung bình (7 ngày qua)
        const examsRes = await pool.query(`SELECT total_score FROM exam_submissions WHERE student_id = $1 AND created_at >= NOW() - INTERVAL '30 days'`, [studentId]);
        const avgScore = examsRes.rows.length > 0 ? (examsRes.rows.reduce((sum, e) => sum + Number(e.total_score), 0) / examsRes.rows.length).toFixed(1) : 'Chưa có';

        // Tỷ lệ chuyên cần (30 ngày qua)
        const attendanceRes = await pool.query(`SELECT status FROM attendance WHERE student_id = $1 AND date >= NOW() - INTERVAL '30 days'`, [studentId]);
        const attendances = attendanceRes.rows;
        const presentSessions = attendances.filter(a => a.status === 'PRESENT').length;
        const attendanceRate = attendances.length > 0 ? Math.round((presentSessions / attendances.length) * 100) : 100;

        // Chuyên đề yếu
        const topicsRes = await pool.query(`SELECT topic, accuracy_rate FROM student_topic_performance WHERE student_id = $1 ORDER BY accuracy_rate ASC LIMIT 5`, [studentId]);

        res.status(200).json({
            profile,
            stats: { avgScore, attendanceRate, examsCount: examsRes.rows.length },
            weakTopics: topicsRes.rows
        });
    } catch (error) {
        console.error(error);
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

        const query = `
            SELECT s.id, s.session_date, s.start_time, s.end_time, c.name as class_name, c.subject
            FROM sessions s
            JOIN classes c ON s.class_id = c.id
            JOIN class_members cm ON cm.class_id = c.id
            WHERE cm.student_id = $1 AND s.session_date >= CURRENT_DATE
            ORDER BY s.session_date ASC, s.start_time ASC
            LIMIT 10
        `;
        const result = await pool.query(query, [studentId]);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
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

        const query = `
            SELECT d.id, d.title, d.type, d.file_url, d.created_at, a.due_at, c.name as class_name
            FROM assignments a
            JOIN documents d ON a.document_id = d.id
            JOIN classes c ON a.class_id = c.id
            JOIN class_members cm ON cm.class_id = c.id
            WHERE cm.student_id = $1
            ORDER BY a.created_at DESC
        `;
        const result = await pool.query(query, [studentId]);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

