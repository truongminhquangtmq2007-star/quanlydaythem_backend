import { Response } from 'express';
import pool from '../db';
import { AuthRequest } from '../middleware/authMiddleware';

// ========================================================
// 1. API GIÁO VIÊN: LƯU ĐÁP ÁN CHUẨN VÀO DATABASE
// ========================================================
export const saveAnswerKey = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { document_id, class_id, part1_key, part2_key, part3_key, allow_view_answers, duration_minutes } = req.body;

        // Nếu part1_key rỗng (do gạt nút), ta sẽ lấy đáp án cũ từ DB để giữ lại
        const currentData = await pool.query('SELECT part1_key, part2_key, part3_key FROM exam_keys WHERE document_id = $1', [document_id]);
        const old = currentData.rows[0] || { part1_key: {}, part2_key: {}, part3_key: {} };

        const p1 = part1_key && Object.keys(part1_key).length > 0 ? part1_key : old.part1_key;
        const p2 = part2_key && Object.keys(part2_key).length > 0 ? part2_key : old.part2_key;
        const p3 = part3_key && Object.keys(part3_key).length > 0 ? part3_key : old.part3_key;

        const result = await pool.query(
            `INSERT INTO exam_keys (document_id, class_id, part1_key, part2_key, part3_key, allow_view_answers, duration_minutes) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) 
             ON CONFLICT (document_id) 
             DO UPDATE SET 
                part1_key = $3, part2_key = $4, part3_key = $5,
                allow_view_answers = $6, duration_minutes = $7
             RETURNING *`,
            [document_id, class_id, p1, p2, p3, allow_view_answers, duration_minutes]
        );

        res.status(200).json({ message: 'Lưu thành công!' });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};
// ========================================================
// 2. API HỌC SINH: NỘP BÀI VÀ CHẤM ĐIỂM TỰ ĐỘNG
// ========================================================
export const submitExam = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const studentId = req.user?.id;
        const { document_id, student_answers, cheat_count } = req.body;

        // 1. Kéo đáp án chuẩn của đề này từ Database
        const keyResult = await pool.query(`SELECT * FROM exam_keys WHERE document_id = $1`, [document_id]);
        if (keyResult.rows.length === 0) {
            res.status(404).json({ message: 'Đề thi này chưa được giáo viên thiết lập đáp án!' });
            return;
        }
        
        const answerKey = keyResult.rows[0];
        let p1Score = 0, p2Score = 0, p3Score = 0;

        // 2. CHẤM PHẦN I (Mỗi câu đúng 0.25 điểm)
        if (student_answers.part1) {
            for (const [q, ans] of Object.entries(student_answers.part1)) {
                if (answerKey.part1_key[q] === ans) p1Score += 0.25;
            }
        }

        // 3. CHẤM PHẦN II (Đúng/Sai - Tính điểm lũy tiến)
        if (student_answers.part2) {
            for (const [q, subAns] of Object.entries(student_answers.part2)) {
                const key = answerKey.part2_key[q];
                if (!key) continue;

                let correctCount = 0;
                const subObj = subAns as any;
                
                // Đếm số ý trả lời đúng (khớp với đáp án chuẩn)
                ['a', 'b', 'c', 'd'].forEach(sub => {
                    if (subObj[sub] && subObj[sub] === key[sub]) correctCount++;
                });

                // Quy tắc lũy tiến 2025
                if (correctCount === 1) p2Score += 0.1;
                else if (correctCount === 2) p2Score += 0.25;
                else if (correctCount === 3) p2Score += 0.5;
                else if (correctCount === 4) p2Score += 1.0;
            }
        }

        // 4. CHẤM PHẦN III (Trả lời ngắn - Mỗi câu đúng 0.5 điểm)
        if (student_answers.part3) {
            for (const [q, ans] of Object.entries(student_answers.part3)) {
                // Ép kiểu về chuỗi và loại bỏ khoảng trắng thừa để đối chiếu chính xác
                const studentVal = String(ans).trim();
                const keyVal = String(answerKey.part3_key[q]).trim();
                
                if (studentVal === keyVal && studentVal !== '') p3Score += 0.5;
            }
        }

        const totalScore = p1Score + p2Score + p3Score;

        // 5. Lưu kết quả, chi tiết bài làm VÀ SỐ LẦN GIAN LẬN vào Database
        const submitResult = await pool.query(
            `INSERT INTO exam_submissions 
            (document_id, student_id, student_answers, total_score, part1_score, part2_score, part3_score, cheat_count) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [document_id, studentId, student_answers, totalScore, p1Score, p2Score, p3Score, cheat_count || 0]
        );

        // 6. Báo cáo kết quả lập tức cho Học sinh
        // 6. Báo cáo kết quả lập tức cho Học sinh (ĐÃ SỬA CHỖ NÀY)
        res.status(200).json({ 
            message: 'Nộp bài và chấm điểm thành công!', 
            score: { 
                totalScore, p1Score, p2Score, p3Score,
                allow_view_answers: answerKey.allow_view_answers // Bổ sung dòng này để báo cho Frontend
            },
            submissionId: submitResult.rows[0].id
        });
    } catch (error) {
        console.error('Lỗi chấm điểm:', error);
        res.status(500).json({ message: 'Lỗi server khi xử lý bài thi' });
    }
};

// ========================================================
// 3. API GIÁO VIÊN: LẤY DANH SÁCH BÀI NỘP CỦA HỌC SINH
// ========================================================
// ========================================================
// 3. API GIÁO VIÊN: LẤY DANH SÁCH BÀI NỘP CỦA HỌC SINH
// ========================================================
export const getExamSubmissions = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { document_id } = req.params;
        // Đã sửa thành u.username khớp với cấu trúc cơ sở dữ liệu của bạn
        const result = await pool.query(
            `SELECT es.*, u.username as student_name 
             FROM exam_submissions es 
             JOIN users u ON es.student_id = u.id 
             WHERE es.document_id = $1 
             ORDER BY es.total_score DESC, es.submitted_at DESC`,
            [document_id]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Lỗi lấy dữ liệu bài thi:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// ========================================================
// 4. API HỌC SINH: LẤY LỊCH SỬ THI CÁ NHÂN
// ========================================================
export const getMySubmissions = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const studentId = req.user?.id;
        const result = await pool.query(
            `SELECT document_id, total_score, submitted_at, time_taken_seconds 
             FROM exam_submissions 
             WHERE student_id = $1 
             ORDER BY submitted_at ASC`,
            [studentId]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Lỗi lấy điểm cá nhân:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// ========================================================
// 5. API GIÁO VIÊN: PHỤC HỒI ĐÁP ÁN CHUẨN ĐÃ LƯU
// ========================================================
export const getExamKey = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { document_id } = req.params;
        const result = await pool.query(
            `SELECT part1_key, part2_key, part3_key, allow_view_answers, duration_minutes 
             FROM exam_keys WHERE document_id = $1`,
            [document_id]
        );
        
        if (result.rows.length > 0) {
            res.status(200).json(result.rows[0]);
        } else {
            res.status(200).json(null);
        }
    } catch (error) {
        console.error('Lỗi lấy đáp án chuẩn:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};