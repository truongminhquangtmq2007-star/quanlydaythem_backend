import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import pool from '../db';
import { buildLearningSnapshot, generateStudentPersonalizedInsight } from '../services/learningInsightService';
import { resolveCanonicalStudentId } from './examController';

export const getLatestInsight = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
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
            const requestedId = req.params.studentId || req.query.studentId || req.body?.studentId;
            if (requestedId && requestedId !== 'me' && Number(requestedId) !== Number(canonicalId)) {
                res.status(403).json({ 
                    status: 'forbidden',
                    message: 'Học sinh không có quyền xem phân tích của học sinh khác.' 
                });
                return;
            }
            targetStudentId = canonicalId;
        } else {
            const rawId = req.params.studentId || req.query.studentId || req.body?.studentId;
            if (!rawId || rawId === 'me') {
                res.status(400).json({ message: 'Thiếu studentId.' });
                return;
            }
            targetStudentId = Number(rawId);

            if (user.role === 'TEACHER') {
                const check = await pool.query(
                    `SELECT 1 FROM students s
                     LEFT JOIN enrollments e ON s.id = e.student_id
                     LEFT JOIN classes c ON e.class_id = c.id
                     WHERE s.id = $1 AND (s.teacher_id = $2 OR c.teacher_id = $2)`,
                    [targetStudentId, user.id]
                );
                if (check.rows.length === 0) {
                    res.status(403).json({ message: "Không có quyền xem phân tích của học sinh này" });
                    return;
                }
            }
        }

        const result = await pool.query(`
            SELECT payload, generated_at, expires_at 
            FROM student_ai_insights 
            WHERE student_id = $1 AND insight_type = 'CURRENT_PROGRESS'
        `, [targetStudentId]);

        if (result.rows.length === 0) {
            res.status(404).json({ 
                status: 'not_found',
                message: 'Chưa có phân tích cho học sinh này.' 
            });
            return;
        }

        res.status(200).json({
            status: 'success',
            data: {
                insight: result.rows[0].payload,
                generated_at: result.rows[0].generated_at,
                expires_at: result.rows[0].expires_at
            }
        });
    } catch (error) {
        console.error("Lỗi getLatestInsight:", error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

export const generateInsight = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
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
            const requestedId = req.params.studentId || req.body?.studentId || req.query?.studentId;
            if (requestedId && requestedId !== 'me' && Number(requestedId) !== Number(canonicalId)) {
                res.status(403).json({ 
                    status: 'forbidden',
                    message: 'Học sinh không có quyền yêu cầu phân tích cho học sinh khác.' 
                });
                return;
            }
            targetStudentId = canonicalId;
        } else {
            const rawId = req.params.studentId || req.body?.studentId || req.query?.studentId;
            if (!rawId || rawId === 'me') {
                res.status(400).json({ message: 'Thiếu studentId.' });
                return;
            }
            targetStudentId = Number(rawId);

            if (user.role === 'TEACHER') {
                const check = await pool.query(
                    `SELECT 1 FROM students s
                     LEFT JOIN enrollments e ON s.id = e.student_id
                     LEFT JOIN classes c ON e.class_id = c.id
                     WHERE s.id = $1 AND (s.teacher_id = $2 OR c.teacher_id = $2)`,
                    [targetStudentId, user.id]
                );
                if (check.rows.length === 0) {
                    res.status(403).json({ message: "Không có quyền phân tích học sinh này" });
                    return;
                }
            }
        }

        // 1. Build Data Snapshot
        const snapshot = await buildLearningSnapshot(targetStudentId);

        if (snapshot.dataQuality === 'INSUFFICIENT') {
            res.status(422).json({ 
                status: 'insufficient_data', 
                message: 'Chưa có đủ dữ liệu để phân tích cá nhân hóa. (Cần ít nhất 1 bài thi hoặc các buổi học gần đây)' 
            });
            return;
        }

        // 2. Generate Insight with AI (or deterministic fallback)
        const aiResponse = await generateStudentPersonalizedInsight(snapshot);

        // 3. Persist to DB (Upsert)
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days expiration
        
        await pool.query(`
            INSERT INTO student_ai_insights (student_id, insight_type, payload, prompt_version, model, expires_at)
            VALUES ($1, 'CURRENT_PROGRESS', $2, 'PERSONALIZATION_PROMPT_V1', 'gemini-3.7-flash', $3)
            ON CONFLICT (student_id, insight_type) 
            DO UPDATE SET 
                payload = EXCLUDED.payload, 
                generated_at = CURRENT_TIMESTAMP, 
                expires_at = EXCLUDED.expires_at,
                prompt_version = EXCLUDED.prompt_version,
                model = EXCLUDED.model
        `, [targetStudentId, JSON.stringify(aiResponse), expiresAt]);

        // 4. Return
        res.status(200).json({
            status: 'success',
            data: {
                insight: aiResponse,
                generated_at: new Date(),
                expires_at: expiresAt
            }
        });
    } catch (error: any) {
        console.error("Lỗi generateInsight:", error);
        if (error.message === 'STUDENT_NOT_FOUND') {
            res.status(404).json({ status: 'not_found', message: 'Không tìm thấy học sinh.' });
        } else if (error.message === 'INSUFFICIENT_DATA') {
            res.status(422).json({ status: 'insufficient_data', message: 'Không đủ dữ liệu.' });
        } else {
            res.status(500).json({ status: 'error', message: 'Lỗi khi phân tích kết quả học tập.' });
        }
    }
};
