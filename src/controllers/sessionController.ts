import { Response } from 'express';
import pool from '../db';
import { AuthRequest } from '../middleware/authMiddleware';

// 1. Hàm lấy danh sách buổi học
// 1. Hàm lấy danh sách buổi học (Hỗ trợ xem Lịch Tổng)
// 1. Hàm lấy danh sách buổi học (Hỗ trợ xem Lịch Tổng & Đếm đánh giá)
export const getSessions = async (req: AuthRequest, res: Response): Promise<void> => {
  const { class_id } = req.query;
  const user = req.user;
  try {
    let result;
    if (class_id) {
      result = await pool.query(
        `SELECT s.*, 
                (SELECT COUNT(*) FROM session_evaluations WHERE session_id = s.id) as eval_count
         FROM sessions s WHERE class_id = $1 ORDER BY session_date ASC`,
        [class_id]
      );
    } else {
      result = await pool.query(
        `SELECT s.*, c.class_name,
                (SELECT COUNT(*) FROM session_evaluations WHERE session_id = s.id) as eval_count
         FROM sessions s 
         JOIN classes c ON s.class_id = c.id 
         WHERE c.teacher_id = $1 ORDER BY s.session_date ASC`,
        [user.id]
      );
    }
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Lỗi lấy danh sách buổi học:", error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// 2. API Lưu Nháp / Cập nhật buổi học (ĐÃ GỌT LẠI CHO KHỚP DB)
export const upsertSession = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id, class_id, session_date, start_time, content, homework } = req.body;
  
  try {
    let result;
    if (id) {
      result = await pool.query(
        `UPDATE sessions 
         SET session_date=$1, start_time=$2, content=$3, homework=$4 
         WHERE id=$5 RETURNING *`,
        [session_date, start_time, content, homework, id]
      );
    } else {
      result = await pool.query(
        `INSERT INTO sessions (class_id, session_date, start_time, content, homework, is_published) 
         VALUES ($1, $2, $3, $4, $5, false) RETURNING *`,
        [class_id, session_date, start_time, content, homework]
      );
    }
    res.status(200).json({ message: 'Đã lưu nháp thành công!', session: result.rows[0] });
  } catch (error) {
    console.error("Lỗi lưu buổi học:", error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// 3. API Chốt Sổ & Công Bố
// 3. API Chốt Sổ & Công Bố (Đã sửa lỗi mất dòng)
export const publishSessions = async (req: AuthRequest, res: Response): Promise<void> => {
  const { class_id } = req.body; 
  try {
    // Chốt toàn bộ các bản nháp của lớp đang được chọn
    await pool.query(
      `UPDATE sessions SET is_published = true WHERE class_id = $1`,
      [class_id]
    );
    res.status(200).json({ message: '🚀 Đã công bố lịch học cho Phụ huynh!' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi công bố' });
  }
};

// 4. API XÓA BUỔI HỌC
export const deleteSession = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM sessions WHERE id = $1', [id]);
    res.status(200).json({ message: 'Đã xóa buổi học' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xóa' });
  }
};
// Hàm dành riêng cho Học sinh/Phụ huynh (Chỉ lấy các buổi đã công bố)
// Hàm dành riêng cho Học sinh/Phụ huynh (Đã nâng cấp để lấy cả Nhận xét)
// Hàm dành riêng cho Học sinh/Phụ huynh (Đã bỏ giới hạn class_id)
// Hàm dành riêng cho Học sinh/Phụ huynh (Đã thêm is_paid để hiện Tem xanh)
// Hàm dành riêng cho Học sinh/Phụ huynh (Đã sắp xếp Mới nhất lên đầu)
export const getPublishedSessions = async (req: AuthRequest, res: Response): Promise<void> => {
  const { student_id } = req.query; 
  try {
    const result = await pool.query(
      `SELECT s.*, 
              e.is_present, e.focus_level, e.teacher_notes, e.is_billed, e.is_paid 
       FROM sessions s
       LEFT JOIN session_evaluations e ON s.id = e.session_id AND e.student_id = $1
       WHERE s.is_published = true 
       ORDER BY s.session_date DESC, s.start_time DESC`, // <-- Sửa ASC thành DESC ở đây
      [student_id]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server' });
  }
};
// 5. Lấy danh sách đánh giá của 1 buổi học cụ thể
export const getEvaluations = async (req: AuthRequest, res: Response): Promise<void> => {
  const { session_id } = req.query;
  try {
    const result = await pool.query(
      `SELECT e.*, s.full_name as student_name 
       FROM session_evaluations e 
       JOIN students s ON e.student_id = s.id 
       WHERE e.session_id = $1`,
      [session_id]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Lỗi lấy danh sách điểm danh:", error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// 6. Lưu điểm danh & nhận xét cho từng học sinh
export const saveEvaluation = async (req: AuthRequest, res: Response): Promise<void> => {
  const { session_id, student_id, is_present, focus_level, teacher_notes } = req.body;
  try {
    // Kiểm tra xem bé này đã được chấm điểm trong buổi này chưa
    const check = await pool.query(
      `SELECT id FROM session_evaluations WHERE session_id = $1 AND student_id = $2`, 
      [session_id, student_id]
    );
    
    if (check.rows.length > 0) {
      // Nếu có rồi thì Cập nhật (Update)
      await pool.query(
        `UPDATE session_evaluations SET is_present=$1, focus_level=$2, teacher_notes=$3 WHERE id=$4`,
        [is_present, focus_level, teacher_notes, check.rows[0].id]
      );
    } else {
      // Nếu chưa có thì Thêm mới (Insert)
      await pool.query(
        `INSERT INTO session_evaluations (session_id, student_id, is_present, focus_level, teacher_notes) 
         VALUES ($1, $2, $3, $4, $5)`,
        [session_id, student_id, is_present, focus_level, teacher_notes]
      );
    }
    res.status(200).json({ message: '✅ Đã lưu đánh giá thành công!' });
  } catch (error) {
    console.error("Lỗi lưu đánh giá:", error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};
// API: Chốt học phí (Đánh dấu các buổi đã học là Đã thanh toán)
export const markSessionsAsBilled = async (req: any, res: any) => {
  const { student_id, start_date, end_date } = req.body;
  
  try {
    // Tìm các buổi học của học sinh này trong khoảng thời gian đã chọn, có đi học và CHƯA thanh toán, sau đó gạt công tắc thành TRUE
    await pool.query(
      `UPDATE session_evaluations
       SET is_billed = true
       FROM sessions
       WHERE session_evaluations.session_id = sessions.id
         AND session_evaluations.student_id = $1
         AND sessions.session_date >= $2
         AND sessions.session_date <= $3
         AND session_evaluations.is_present = true
         AND session_evaluations.is_billed = false`,
      [student_id, start_date, end_date]
    );
    
    res.status(200).json({ message: 'Đã chốt sổ thành công!' });
  } catch (error) {
    console.error("Lỗi chốt học phí:", error);
    res.status(500).json({ message: 'Lỗi server khi chốt học phí' });
  }
};