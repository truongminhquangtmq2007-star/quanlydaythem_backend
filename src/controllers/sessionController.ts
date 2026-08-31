import { Response } from 'express';
import pool from '../db';
import { google } from 'googleapis';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'dummy_id';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'dummy_secret';
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://quanlydaythem-api.onrender.com/api/calendar/callback';

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
      if (user?.role === 'TEACHER') {
        const check = await pool.query('SELECT id FROM classes WHERE id = $1 AND teacher_id = $2', [class_id, user.id]);
        if (check.rows.length === 0) {
          res.status(403).json({ message: "Không có quyền xem lịch của lớp này" });
          return;
        }
      }
      result = await pool.query(
        `SELECT s.*, 
                (SELECT COUNT(*) FROM session_evaluations WHERE session_id = s.id) as eval_count,
                (SELECT COUNT(*) FROM attendance a WHERE a.class_id = s.class_id AND a.attendance_date = s.session_date) as attendance_count
         FROM sessions s WHERE class_id = $1 ORDER BY session_date ASC`,
        [class_id]
      );
    } else {
      if (user?.role === 'ADMIN') {
        result = await pool.query(
          `SELECT s.*, c.class_name,
                  (SELECT COUNT(*) FROM session_evaluations WHERE session_id = s.id) as eval_count,
                  (SELECT COUNT(*) FROM attendance a WHERE a.class_id = s.class_id AND a.attendance_date = s.session_date) as attendance_count
           FROM sessions s 
           JOIN classes c ON s.class_id = c.id 
           ORDER BY s.session_date ASC`
        );
      } else {
        result = await pool.query(
          `SELECT s.*, c.class_name,
                  (SELECT COUNT(*) FROM session_evaluations WHERE session_id = s.id) as eval_count,
                  (SELECT COUNT(*) FROM attendance a WHERE a.class_id = s.class_id AND a.attendance_date = s.session_date) as attendance_count
           FROM sessions s 
           JOIN classes c ON s.class_id = c.id 
           WHERE c.teacher_id = $1 ORDER BY s.session_date ASC`,
          [user?.id]
        );
      }
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
    const user = req.user;
    if (user?.role === 'TEACHER') {
        let checkClassId = class_id;
        if (id) {
            const getSession = await pool.query('SELECT class_id FROM sessions WHERE id = $1', [id]);
            if (getSession.rows.length > 0) checkClassId = getSession.rows[0].class_id;
        }
        if (checkClassId) {
            const check = await pool.query('SELECT id FROM classes WHERE id = $1 AND teacher_id = $2', [checkClassId, user.id]);
            if (check.rows.length === 0) {
                res.status(403).json({ message: "Không có quyền sửa lớp này" });
                return;
            }
        }
    }

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
    const user = req.user;
    if (user?.role === 'TEACHER') {
        const check = await pool.query('SELECT id FROM classes WHERE id = $1 AND teacher_id = $2', [class_id, user.id]);
        if (check.rows.length === 0) {
            res.status(403).json({ message: "Không có quyền sửa lớp này" });
            return;
        }
    }
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
    const user = req.user;
    if (user?.role === 'TEACHER') {
        const check = await pool.query('SELECT c.id FROM sessions s JOIN classes c ON s.class_id = c.id WHERE s.id = $1 AND c.teacher_id = $2', [id, user.id]);
        if (check.rows.length === 0) {
            res.status(403).json({ message: "Không có quyền xóa session này" });
            return;
        }
    }
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
              e.is_present, e.focus_level, e.teacher_notes, e.is_billed, 
              (SELECT EXISTS(
                   SELECT 1 FROM tuition_bills b 
                   WHERE b.student_id = $1 
                     AND s.session_date >= b.start_date 
                     AND s.session_date <= b.end_date 
                     AND b.is_paid = true
              )) as is_paid 
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
  const user = req.user;
  try {
    if (user?.role === 'TEACHER') {
      const check = await pool.query('SELECT c.id FROM sessions s JOIN classes c ON s.class_id = c.id WHERE s.id = $1 AND c.teacher_id = $2', [session_id, user.id]);
      if (check.rows.length === 0) {
        res.status(403).json({ message: "Không có quyền xem đánh giá này" });
        return;
      }
    }
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
  const user = req.user;
  try {
    if (user?.role === 'TEACHER') {
      const check = await pool.query('SELECT c.id FROM sessions s JOIN classes c ON s.class_id = c.id WHERE s.id = $1 AND c.teacher_id = $2', [session_id, user.id]);
      if (check.rows.length === 0) {
        res.status(403).json({ message: "Không có quyền lưu đánh giá cho buổi học này" });
        return;
      }
    }
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
export const syncCalendar = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // session id
    const teacherId = req.user?.id;

    if (!teacherId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const sessionRes = await pool.query('SELECT * FROM sessions WHERE id = $1', [id]);
    if (sessionRes.rows.length === 0) {
      res.status(404).json({ message: 'Không tìm thấy buổi học' });
      return;
    }
    const session = sessionRes.rows[0];

    const userResult = await pool.query('SELECT google_calendar_tokens FROM users WHERE id = $1', [teacherId]);
    const tokens = userResult.rows[0]?.google_calendar_tokens;
    if (!tokens) {
      res.status(400).json({ message: 'Chưa liên kết Google Calendar' });
      return;
    }

    const parsedTokens = typeof tokens === 'string' ? JSON.parse(tokens) : tokens;
    const userOAuth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI);
    userOAuth2Client.setCredentials(parsedTokens);
    const calendar = google.calendar({ version: 'v3', auth: userOAuth2Client });

    // Get emails
    const emailsRes = await pool.query(
      `SELECT s.email FROM students s
       JOIN enrollments cm ON s.id = cm.student_id
       WHERE cm.class_id = $1 AND cm.status = 'ACTIVE' AND s.is_active = true AND s.email IS NOT NULL`,
      [session.class_id]
    );
    const attendees = emailsRes.rows.map(r => ({ email: r.email }));

    if (session.google_event_id) {
      // Update existing event
      await calendar.events.patch({
        calendarId: 'primary',
        eventId: session.google_event_id,
        requestBody: {
          attendees: attendees
        }
      });
      res.status(200).json({ message: 'Đồng bộ lại lịch Google thành công' });
    } else {
      // Create new event
      const event = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: session.content || 'Lịch học',
          start: { dateTime: session.session_date + 'T' + (session.start_time || '18:00') + ':00+07:00', timeZone: 'Asia/Ho_Chi_Minh' },
          end: { dateTime: session.session_date + 'T' + (session.end_time || '19:30') + ':00+07:00', timeZone: 'Asia/Ho_Chi_Minh' },
          attendees: attendees.length > 0 ? attendees : undefined
        }
      });
      await pool.query('UPDATE sessions SET google_event_id = $1 WHERE id = $2', [event.data.id, session.id]);
      res.status(200).json({ message: 'Tạo mới và đồng bộ lịch Google thành công' });
    }
  } catch (error) {
    console.error("Lỗi đồng bộ lại Google Calendar:", error);
    res.status(500).json({ message: 'Lỗi khi đồng bộ Google Calendar' });
  }
};
