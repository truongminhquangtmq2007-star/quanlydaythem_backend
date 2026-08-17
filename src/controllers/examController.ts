import { Response } from 'express';
import pool from '../db';
import { AuthRequest } from '../middleware/authMiddleware';
// 👇 Nhập hàm gọi Gemini từ service bạn vừa tạo
import { parseFullExamWithGemini } from '../services/geminiService';


// ========================================================
// 1. API GIÁO VIÊN: LƯU ĐÁP ÁN CHUẨN VÀO DATABASE
// ========================================================
export const saveAnswerKey = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { document_id, class_id, part1_key, part2_key, part3_key, allow_view_answers, duration_minutes } = req.body;

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
        console.error('LỖI LƯU ĐÁP ÁN CHI TIẾT:', error);
        res.status(500).json({ message: 'Lỗi server', detail: (error as Error).message });
    }
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

        if (student_answers.part3) {
            for (const [q, ans] of Object.entries(student_answers.part3)) {
                const studentVal = String(ans).trim();
                const keyVal = String(answerKey.part3_key[q]).trim();
                
                if (studentVal === keyVal && studentVal !== '') p3Score += 0.5;
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

// ========================================================
// 6. API MỚI: TỰ ĐỘNG TẠO ĐỀ VÀ ĐÁP ÁN TỪ VĂN BẢN (GEMINI)
// ========================================================
export const createExamFromText = async (req: AuthRequest, res: Response): Promise<void> => {
    // SỬA Ở ĐÂY: Hứng đúng tên biến document_id và class_id từ Frontend/Postman gửi lên
    const { rawText, class_id, document_id, durationMinutes } = req.body;
  
    try {
      // 1. Gửi văn bản cho Gemini xử lý
      const fullExam = await parseFullExamWithGemini(rawText);
  
      // 2. Trích xuất đáp án đúng của từng phần
      const part1Key = fullExam.part1.reduce((acc: any, q: any) => {
        acc[q.id] = q.correctAnswer;
        return acc;
      }, {});
  
      const part2Key = fullExam.part2.reduce((acc: any, q: any) => {
        acc[q.id] = q.correctAnswer;
        return acc;
      }, {});
  
      const part3Key = fullExam.part3.reduce((acc: any, q: any) => {
        acc[q.id] = q.correctAnswer;
        return acc;
      }, {});
  
      // 3. Tự động lưu đáp án chuẩn vào Database
      const checkExist = await pool.query('SELECT id FROM exam_keys WHERE document_id = $1', [document_id]);
  
      let result;
      if (checkExist.rows.length > 0) {
        // Nếu đã tồn tại đáp án cho đề này -> Cập nhật lại
        result = await pool.query(
          `UPDATE exam_keys 
           SET part1_key = $1, part2_key = $2, part3_key = $3, duration_minutes = $4
           WHERE document_id = $5
           RETURNING *`,
          [
            JSON.stringify(part1Key),
            JSON.stringify(part2Key),
            JSON.stringify(part3Key),
            durationMinutes || 50,
            document_id
          ]
        );
      } else {
        // Nếu chưa có -> Thêm mới
        result = await pool.query(
          `INSERT INTO exam_keys (document_id, class_id, part1_key, part2_key, part3_key, duration_minutes, allow_view_answers)
           VALUES ($1, $2, $3, $4, $5, $6, true)
           RETURNING *`,
          [
            document_id,
            class_id,
            JSON.stringify(part1Key),
            JSON.stringify(part2Key),
            JSON.stringify(part3Key),
            durationMinutes || 50
          ]
        );
      }
  
      // 4. Trả về cả đáp án đã lưu (cho DB) và nội dung chi tiết (cho Frontend hiển thị)
      res.status(200).json({
        message: 'Tạo đề thi 3 phần bằng AI thành công!',
        examKey: result.rows[0],
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
        // Ép kiểu req sang any để lấy thuộc tính file do Multer gắn vào
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

        // 3. Tự động lưu đáp án chuẩn vào Database
        const checkExist = await pool.query('SELECT id FROM exam_keys WHERE document_id = $1', [document_id]);

        let result;
        if (checkExist.rows.length > 0) {
            result = await pool.query(
                `UPDATE exam_keys 
                 SET part1_key = $1, part2_key = $2, part3_key = $3, duration_minutes = $4
                 WHERE document_id = $5 RETURNING *`,
                [JSON.stringify(part1Key), JSON.stringify(part2Key), JSON.stringify(part3Key), durationMinutes || 50, document_id]
            );
        } else {
            result = await pool.query(
                `INSERT INTO exam_keys (document_id, class_id, part1_key, part2_key, part3_key, duration_minutes, allow_view_answers)
                 VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING *`,
                [document_id, class_id, JSON.stringify(part1Key), JSON.stringify(part2Key), JSON.stringify(part3Key), durationMinutes || 50]
            );
        }

        console.log('--- XỬ LÝ FILE HOÀN TẤT ---');

        // 4. Trả về kết quả cho Frontend hiển thị
        res.status(200).json({ 
            message: 'Phân tích file bằng AI thành công!',
            examKey: result.rows[0],
            examContent: fullExam
        });
    } catch (error: any) {
        console.error('Lỗi nhận và xử lý file:', error);
        res.status(500).json({ message: 'Lỗi server khi AI xử lý file', detail: error.message });
    }
};