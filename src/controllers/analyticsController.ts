import { Response } from 'express';
import pool from '../db';
import { AuthRequest } from '../middleware/authMiddleware';

// ========================================================
// 1. LẤY PHÂN TÍCH CHUYÊN ĐỀ CỦA MỘT HỌC SINH
// GET /api/analytics/students/:id/topics
// ========================================================
export const getStudentTopics = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT * FROM student_topic_performance 
             WHERE student_id = $1 
             ORDER BY accuracy_rate DESC`,
            [id]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Lỗi getStudentTopics:', error);
        res.status(500).json({ message: 'Lỗi server khi lấy dữ liệu phân tích' });
    }
};

// ========================================================
// 2. LẤY DANH SÁCH CHUYÊN ĐỀ YẾU KÉM NHẤT CỦA LỚP
// GET /api/analytics/classes/:id/weak-topics
// ========================================================
export const getClassWeakTopics = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT 
                stp.topic, 
                SUM(stp.attempt_count) as total_attempts,
                SUM(stp.correct_count) as total_corrects,
                ROUND(CAST(SUM(stp.correct_count) AS NUMERIC) * 100.0 / SUM(stp.attempt_count), 2) as accuracy_rate
             FROM student_topic_performance stp
             JOIN class_members cm ON stp.student_id = cm.student_id
             WHERE cm.class_id = $1 AND cm.status = 'ACTIVE'
             GROUP BY stp.topic
             HAVING SUM(stp.attempt_count) > 0
             ORDER BY accuracy_rate ASC
             LIMIT 10`,
            [id]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Lỗi getClassWeakTopics:', error);
        res.status(500).json({ message: 'Lỗi server khi phân tích dữ liệu lớp' });
    }
};

