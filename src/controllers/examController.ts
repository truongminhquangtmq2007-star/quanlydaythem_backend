import { Response } from 'express';
import pool from '../db';
import { AuthRequest } from '../middleware/authMiddleware';
// 👇 Nhập hàm gọi Gemini từ service bạn vừa tạo
import {
    parseFullExamWithGemini,
    parseFullExamFromFileWithGemini
} from '../services/geminiService';
// ========================================================
// 1. API GIÁO VIÊN: LƯU ĐÁP ÁN CHUẨN VÀ NỘI DUNG ĐỀ VÀO DATABASE
// ========================================================
export const saveAnswerKey = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        // NHẬN THÊM BIẾN exam_content TỪ FRONTEND
        const { document_id, class_id, part1_key, part2_key, part3_key, allow_view_answers, duration_minutes, exam_content } = req.body;
        const documentCheck = await pool.query(
    'SELECT id FROM documents WHERE id = $1',
    [document_id]
);

if (documentCheck.rows.length === 0) {
    res.status(400).json({
        message: `Tài liệu có ID ${document_id} không tồn tại`
    });
    return;
}     
const currentData = await pool.query(
    `SELECT 
        part1_key,
        part2_key,
        part3_key,
        exam_content,
        allow_view_answers,
        duration_minutes
     FROM exam_keys
     WHERE document_id = $1`,
    [document_id]
);        const old = currentData.rows[0] || {
    part1_key: {},
    part2_key: {},
    part3_key: {},
    exam_content: null
};
const finalExamContent =
    exam_content !== undefined
        ? exam_content
        : old.exam_content;

        const p1 = part1_key && Object.keys(part1_key).length > 0 ? part1_key : old.part1_key;
        const p2 = part2_key && Object.keys(part2_key).length > 0 ? part2_key : old.part2_key;
        const p3 = part3_key && Object.keys(part3_key).length > 0 ? part3_key : old.part3_key;

        // CẬP NHẬT LỆNH SQL: THÊM exam_content VÀO CẢ INSERT LẪN UPDATE
        const result = await pool.query(
            `INSERT INTO exam_keys (document_id, class_id, part1_key, part2_key, part3_key, allow_view_answers, duration_minutes, exam_content) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
             ON CONFLICT (document_id) 
             DO UPDATE SET 
                part1_key = $3, part2_key = $4, part3_key = $5,
                allow_view_answers = $6, duration_minutes = $7, exam_content = $8
             RETURNING *`,
            [
    document_id,
    class_id,
    p1,
    p2,
    p3,
    allow_view_answers,
    duration_minutes,
    finalExamContent
]
        );

        res.status(200).json({ message: 'Lưu đề thi và đáp án thành công!' });
    } catch (error) {
        console.error('LỖI LƯU ĐÁP ÁN VÀ NỘI DUNG ĐỀ:', error);
        res.status(500).json({ message: 'Lỗi server', detail: (error as Error).message });
    }
};
const normalizeShortAnswer = (value: any): string => {
    return String(value ?? '')
        .trim()
        .replace(/\s+/g, '')
        .replace(',', '.');
};
// ========================================================
// 2. API HỌC SINH: NỘP BÀI VÀ CHẤM ĐIỂM TỰ ĐỘNG
// ========================================================
export const submitExam = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const studentId = req.user?.id;
        const { document_id, student_answers, cheat_count } = req.body;

        const keyResult = await pool.query(`SELECT * FROM exam_keys WHERE document_id = $1`, [document_id]);
        if (keyResult.rows.length === 0) {
            res.status(404).json({ message: 'Đề thi này chưa được giáo viên thiết lập đáp án!' });
            return;
        }
        
        const answerKey = keyResult.rows[0];
        let p1Score = 0, p2Score = 0, p3Score = 0;

        if (student_answers.part1) {
            for (const [q, ans] of Object.entries(student_answers.part1)) {
                if (answerKey.part1_key[q] === ans) p1Score += 0.25;
            }
        }

        if (student_answers.part2) {
            for (const [q, subAns] of Object.entries(student_answers.part2)) {
                const key = answerKey.part2_key[q];
                if (!key) continue;

                let correctCount = 0;
                const subObj = subAns as any;
                
                ['a', 'b', 'c', 'd'].forEach(sub => {
                    if (subObj[sub] && subObj[sub] === key[sub]) correctCount++;
                });

                if (correctCount === 1) p2Score += 0.1;
                else if (correctCount === 2) p2Score += 0.25;
                else if (correctCount === 3) p2Score += 0.5;
                else if (correctCount === 4) p2Score += 1.0;
            }
        }

        // ========================================================
// CHẤM ĐIỂM PHẦN 3 - TỰ ĐỘNG THEO SỐ CÂU PHẦN 1
// ========================================================

// Đếm tổng số câu trắc nghiệm Phần 1
const part1QuestionCount = Object.keys(answerKey.part1_key || {}).length;

// Mặc định mỗi câu trả lời ngắn là 0.5 điểm
let part3PointPerQuestion = 0.5;

// Nếu Phần 1 có từ 18 câu trở lên thì mỗi câu Phần 3 là 0.25 điểm
if (part1QuestionCount >= 18) {
    part3PointPerQuestion = 0.25;
}

console.log('Số câu Phần 1:', part1QuestionCount);
console.log('Điểm mỗi câu Phần 3:', part3PointPerQuestion);

if (student_answers.part3) {
    for (const [q, ans] of Object.entries(student_answers.part3)) {
        const studentVal = normalizeShortAnswer(ans);

        // Kiểm tra đáp án có tồn tại trước
        const correctAnswer = answerKey.part3_key?.[q];

        if (correctAnswer === undefined || correctAnswer === null) {
            continue;
        }

        const keyVal = normalizeShortAnswer(correctAnswer);

        // Đúng đáp án và không được để trống
        if (studentVal === keyVal && studentVal !== '') {
            p3Score += part3PointPerQuestion;
        }
    }
}

        const totalScore = p1Score + p2Score + p3Score;

        const submitResult = await pool.query(
            `INSERT INTO exam_submissions 
            (document_id, student_id, student_answers, total_score, part1_score, part2_score, part3_score, cheat_count) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [document_id, studentId, student_answers, totalScore, p1Score, p2Score, p3Score, cheat_count || 0]
        );

        res.status(200).json({ 
            message: 'Nộp bài và chấm điểm thành công!', 
            score: { 
                totalScore, p1Score, p2Score, p3Score,
                allow_view_answers: answerKey.allow_view_answers
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
export const getExamSubmissions = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { document_id } = req.params;
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
    `SELECT 
        es.id,
        es.document_id,
        d.title,
        es.total_score,
        es.part1_score,
        es.part2_score,
        es.part3_score,
        es.cheat_count,
        es.submitted_at,
        es.time_taken_seconds
     FROM exam_submissions es
     LEFT JOIN documents d ON d.id = es.document_id
     WHERE es.student_id = $1
     ORDER BY es.submitted_at DESC`,
    [studentId]
);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Lỗi lấy điểm cá nhân:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// ========================================================
// 5. API GIÁO VIÊN/HỌC SINH: LẤY DỮ LIỆU ĐỀ THI
// ========================================================
export const getExamKey = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { document_id } = req.params;
        
        // CẬP NHẬT LỆNH SQL: SELECT THÊM exam_content ĐỂ TRẢ VỀ CHO FRONTEND
        const result = await pool.query(
            `SELECT part1_key, part2_key, part3_key, allow_view_answers, duration_minutes, exam_content 
             FROM exam_keys WHERE document_id = $1`,
            [document_id]
        );
        
        if (result.rows.length > 0) {
            res.status(200).json(result.rows[0]);
        } else {
            res.status(200).json(null);
        }
    } catch (error) {
        console.error('Lỗi lấy dữ liệu đề thi:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// ========================================================
// 6. API MỚI: TỰ ĐỘNG TẠO ĐỀ VÀ ĐÁP ÁN TỪ VĂN BẢN (GEMINI)
// ========================================================
export const createExamFromText = async (req: AuthRequest, res: Response): Promise<void> => {
    const { rawText, class_id, document_id, durationMinutes } = req.body;
  
    try {
      // 1. Gửi văn bản cho Gemini xử lý (Đã sửa lại gọi đúng hàm Text)
    const fullExam = await parseFullExamWithGemini(rawText);  
      // 2. Trích xuất đáp án đúng của từng phần
      const part1Key = fullExam.part1.reduce((acc: any, q: any) => { acc[q.id] = q.correctAnswer; return acc; }, {});
      const part2Key = fullExam.part2.reduce((acc: any, q: any) => { acc[q.id] = q.correctAnswer; return acc; }, {});
      const part3Key = fullExam.part3.reduce((acc: any, q: any) => { acc[q.id] = q.correctAnswer; return acc; }, {});
  
      // 3. KHÔNG LƯU DATABASE TỰ ĐỘNG NỮA. CHỈ TRẢ VỀ CHO FRONTEND.
      res.status(200).json({
        message: 'Bóc tách văn bản thành công! Vui lòng kiểm tra và chỉnh sửa trước khi lưu.',
        examKey: {
            part1_key: part1Key,
            part2_key: part2Key,
            part3_key: part3Key,
            document_id: document_id,
            class_id: class_id,
            duration_minutes: durationMinutes || 50
        },
        examContent: fullExam, 
      });
    } catch (error: any) {
      console.error('Lỗi bóc tách đề bằng AI:', error);
      res.status(500).json({ message: 'Lỗi bóc tách đề', detail: error.message });
    }
};

// ========================================================
// 7. API MỚI: TỰ ĐỘNG TẠO ĐỀ TỪ FILE (PDF/ẢNH)
// ========================================================
export const parseExamFromFile = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { document_id, class_id, durationMinutes } = req.body;
        const file = (req as any).file; 

        if (!file) {
            res.status(400).json({ message: 'Không tìm thấy file tải lên!' });
            return;
        }

        console.log('--- ĐANG GỬI FILE CHO GEMINI AI XỬ LÝ ---');

        // 1. Gửi file cho Gemini xử lý
        const fullExam = await parseFullExamFromFileWithGemini(file);

        // 2. Trích xuất đáp án đúng của từng phần
        const part1Key = fullExam.part1.reduce((acc: any, q: any) => { acc[q.id] = q.correctAnswer; return acc; }, {});
        const part2Key = fullExam.part2.reduce((acc: any, q: any) => { acc[q.id] = q.correctAnswer; return acc; }, {});
        const part3Key = fullExam.part3.reduce((acc: any, q: any) => { acc[q.id] = q.correctAnswer; return acc; }, {});

        console.log('--- XỬ LÝ FILE HOÀN TẤT ---');

        // 3. KHÔNG LƯU DATABASE TỰ ĐỘNG NỮA. CHỈ TRẢ VỀ CHO FRONTEND.
        res.status(200).json({ 
            message: 'Phân tích file bằng AI thành công! Vui lòng kiểm tra và chỉnh sửa trước khi lưu.',
            examKey: {
                part1_key: part1Key,
                part2_key: part2Key,
                part3_key: part3Key,
                document_id: document_id,
                class_id: class_id,
                duration_minutes: durationMinutes || 50
            },
            examContent: fullExam
        });
    } catch (error: any) {
        console.error('Lỗi nhận và xử lý file:', error);
        res.status(500).json({ message: 'Lỗi server khi AI xử lý file', detail: error.message });
    }
};