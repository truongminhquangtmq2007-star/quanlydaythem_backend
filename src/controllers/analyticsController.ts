import { Response } from 'express';
import pool from '../db';
import { AuthRequest } from '../middleware/authMiddleware';
import { resolveCanonicalStudentId } from './examController';

// ========================================================
// 1. LẤY PHÂN TÍCH CHUYÊN ĐỀ CỦA MỘT HỌC SINH
// GET /api/analytics/students/:id/topics
// ========================================================
export const getStudentTopics = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const user = req.user;

        if (!user) {
            res.status(401).json({ message: 'Chưa đăng nhập' });
            return;
        }

        let targetStudentId: number | null = null;

        if (user.role === 'STUDENT') {
            const canonicalId = await resolveCanonicalStudentId(user);
            if (!canonicalId) {
                res.status(403).json({ 
                    status: 'forbidden',
                    message: 'Tài khoản học sinh không hợp lệ hoặc chưa được liên kết với hồ sơ học sinh.' 
                });
                return;
            }

            if (id && id !== 'me' && Number(id) !== Number(canonicalId)) {
                res.status(403).json({ 
                    status: 'forbidden',
                    message: 'Học sinh không có quyền xem dữ liệu của học sinh khác.' 
                });
                return;
            }
            targetStudentId = canonicalId;
        } else {
            if (!id || id === 'me') {
                res.status(400).json({ message: 'Thiếu student id.' });
                return;
            }
            targetStudentId = Number(id);

            if (user.role === 'TEACHER') {
                const check = await pool.query(
                    `SELECT 1 FROM students s
                     LEFT JOIN enrollments e ON s.id = e.student_id
                     LEFT JOIN classes c ON e.class_id = c.id
                     WHERE s.id = $1 AND (s.teacher_id = $2 OR c.teacher_id = $2)`,
                    [targetStudentId, user.id]
                );
                if (check.rows.length === 0) {
                    res.status(403).json({ message: "Không có quyền xem dữ liệu của học sinh này" });
                    return;
                }
            }
        }

        // 1. Query bảng canonical: student_topic_performance
        const result = await pool.query(
            `SELECT 
                id, 
                student_id, 
                topic_name, 
                topic_name AS topic, 
                total_questions, 
                correct_answers, 
                accuracy_rate, 
                last_updated
             FROM student_topic_performance 
             WHERE student_id = $1 
             ORDER BY accuracy_rate DESC, total_questions DESC`,
            [targetStudentId]
        );

        if (result.rows.length > 0) {
            res.status(200).json(result.rows);
            return;
        }

        // 2. Fallback: Nếu bảng student_topic_performance chưa có dòng nào,
        // thử tổng hợp từ topic_performance JSONB của các bài thi COMPLETED
        const jsonbRes = await pool.query(
            `SELECT topic_performance 
             FROM exam_submissions 
             WHERE student_id = $1 AND status = 'COMPLETED' AND topic_performance IS NOT NULL 
             LIMIT 20`,
            [targetStudentId]
        );

        if (jsonbRes.rows.length > 0) {
            const aggregate: Record<string, { correct: number; total: number }> = {};
            for (const row of jsonbRes.rows) {
                const tp = row.topic_performance as Record<string, any>;
                if (tp && typeof tp === 'object') {
                    for (const [topic, stats] of Object.entries(tp)) {
                        const cleanTopic = String(topic).trim();
                        if (!aggregate[cleanTopic]) aggregate[cleanTopic] = { correct: 0, total: 0 };
                        aggregate[cleanTopic].correct += Number(stats.correct || stats.corrects || 0);
                        aggregate[cleanTopic].total += Number(stats.total || stats.attempts || 0);
                    }
                }
            }

            const aggregatedRows = Object.entries(aggregate).map(([topic_name, s], idx) => ({
                id: idx + 1,
                student_id: targetStudentId,
                topic_name,
                topic: topic_name,
                total_questions: s.total,
                correct_answers: s.correct,
                accuracy_rate: s.total > 0 ? Math.round((s.correct / s.total) * 1000) / 10 : 0,
                last_updated: new Date()
            })).sort((a, b) => b.accuracy_rate - a.accuracy_rate);

            res.status(200).json(aggregatedRows);
            return;
        }

        // Trả về mảng rỗng nếu học sinh chưa có dữ liệu làm bài (KHÔNG dùng mock data giả định)
        res.status(200).json([]);
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
        const user = req.user;

        if (!user) {
            res.status(401).json({ message: 'Chưa đăng nhập' });
            return;
        }

        // Kiểm tra quyền (TEACHER chỉ được xem lớp của mình)
        if (user.role === 'TEACHER') {
            const classRes = await pool.query('SELECT teacher_id FROM classes WHERE id = $1', [id]);
            if (classRes.rows.length === 0 || Number(classRes.rows[0].teacher_id) !== Number(user.id)) {
                res.status(403).json({ message: 'Bạn không có quyền xem dữ liệu lớp học này.' });
                return;
            }
        }

        // Query bảng canonical: student_topic_performance
        const result = await pool.query(
            `SELECT 
                stp.topic_name AS topic, 
                SUM(stp.total_questions)::int as total_attempts,
                SUM(stp.correct_answers)::int as total_corrects,
                ROUND(CAST(SUM(stp.correct_answers) AS NUMERIC) * 100.0 / NULLIF(SUM(stp.total_questions), 0), 2) as accuracy_rate
             FROM student_topic_performance stp
             JOIN enrollments cm ON stp.student_id = cm.student_id
             WHERE cm.class_id = $1 AND (cm.status IS NULL OR cm.status = 'ACTIVE' OR cm.status = 'Đang học')
             GROUP BY stp.topic_name
             HAVING SUM(stp.total_questions) > 0
             ORDER BY accuracy_rate ASC
             LIMIT 10`,
            [id]
        );

        // Trả về kết quả thực tế (hoặc mảng rỗng nếu lớp chưa có bài làm, KHÔNG dùng mock data)
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Lỗi getClassWeakTopics:', error);
        res.status(500).json({ message: 'Lỗi server khi phân tích dữ liệu lớp' });
    }
};
