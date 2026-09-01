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
  const sessionId = req.body.id || req.params.id;
  const { class_id, session_date, start_time, end_time, content, homework } = req.body;
  
  try {
    const user = req.user;
    if (user?.role === 'TEACHER') {
        let checkClassId = class_id;
        if (sessionId) {
            const getSession = await pool.query('SELECT class_id FROM sessions WHERE id = $1', [sessionId]);
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
    if (sessionId) {
      result = await pool.query(
        `UPDATE sessions 
         SET session_date=$1, start_time=$2, content=$3, homework=$4 
         WHERE id=$5 RETURNING *`,
        [session_date, start_time || '18:00', content || null, homework || null, sessionId]
      );
    } else {
      result = await pool.query(
        `INSERT INTO sessions (class_id, session_date, start_time, content, homework, is_published) 
         VALUES ($1, $2, $3, $4, $5, false) RETURNING *`,
        [class_id, session_date, start_time || '18:00', content || null, homework || null]
      );
    }
    res.status(200).json({ message: 'Đã lưu buổi học thành công!', session: result.rows[0] });
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
      res.status(401).json({ message: 'Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn' });
      return;
    }

    const sessionRes = await pool.query(
      `SELECT s.*, c.teacher_id, c.class_name 
       FROM sessions s 
       JOIN classes c ON s.class_id = c.id 
       WHERE s.id = $1`,
      [id]
    );
    if (sessionRes.rows.length === 0) {
      res.status(404).json({ message: 'Không tìm thấy buổi học' });
      return;
    }
    const session = sessionRes.rows[0];

    if (req.user?.role === 'TEACHER' && session.teacher_id !== teacherId) {
      res.status(403).json({ message: 'Bạn không có quyền đồng bộ buổi học của lớp khác' });
      return;
    }

    if (!session.is_published) {
      res.status(400).json({ message: 'Buổi học đang ở trạng thái Nháp. Vui lòng bấm "Công bố buổi học" trước khi đồng bộ Google Calendar.' });
      return;
    }

    const userResult = await pool.query('SELECT google_calendar_tokens, full_name, email FROM users WHERE id = $1', [teacherId]);
    const rawTokens = userResult.rows[0]?.google_calendar_tokens;
    if (!rawTokens) {
      res.status(400).json({ message: 'Tài khoản chưa liên kết Google Calendar. Vui lòng bấm "Tích hợp Google Calendar" để cấp quyền trước.' });
      return;
    }

    let parsedTokens: any;
    try {
      parsedTokens = typeof rawTokens === 'string' ? JSON.parse(rawTokens) : rawTokens;
    } catch (parseErr) {
      res.status(400).json({ message: 'Dữ liệu Google Calendar Token không hợp lệ. Vui lòng bấm "Tích hợp Google Calendar" để kết nối lại.' });
      return;
    }

    if (!parsedTokens || (!parsedTokens.access_token && !parsedTokens.refresh_token)) {
      res.status(400).json({ message: 'Tài khoản chưa có mã xác thực Google Calendar hợp lệ. Vui lòng kết nối lại.' });
      return;
    }

    const userOAuth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI);
    userOAuth2Client.setCredentials(parsedTokens);
    const calendar = google.calendar({ version: 'v3', auth: userOAuth2Client });

    let googleEmail = parsedTokens.google_email || '';
    if (!googleEmail) {
      try {
        const oauth2 = google.oauth2({ version: 'v2', auth: userOAuth2Client });
        const userInfo = await oauth2.userinfo.get();
        googleEmail = userInfo.data.email || '';
      } catch (e) {
        console.warn('Could not fetch google userinfo email:', e);
      }
    }

    // Format local ISO date cleanly
    let dateStr = '';
    if (session.session_date instanceof Date) {
      dateStr = session.session_date.toISOString().substring(0, 10);
    } else {
      dateStr = String(session.session_date).substring(0, 10);
    }

    const rawStart = session.start_time ? String(session.start_time).trim() : '18:00';
    const startParts = rawStart.split(':');
    const startHour = parseInt(startParts[0] || '18', 10);
    const startMin = parseInt(startParts[1] || '0', 10);
    const startT = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}:00`;

    // Calculate end time if not provided: default +90 minutes
    let endT = '';
    if (session.end_time) {
      const rawEnd = String(session.end_time).trim();
      const endParts = rawEnd.split(':');
      const endHour = parseInt(endParts[0] || '19', 10);
      const endMin = parseInt(endParts[1] || '30', 10);
      endT = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00`;
    } else {
      const totalStartMin = startHour * 60 + startMin;
      const totalEndMin = totalStartMin + 90;
      const endHour = Math.floor(totalEndMin / 60) % 24;
      const endMin = totalEndMin % 60;
      endT = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00`;
    }

    // Get active students' emails strictly for this class
    const emailsRes = await pool.query(
      `SELECT s.email, s.full_name FROM students s
       JOIN enrollments cm ON s.id = cm.student_id
       WHERE cm.class_id = $1 
         AND (cm.status IS NULL OR cm.status = 'ACTIVE' OR cm.status = 'Đang học') 
         AND (s.is_active = true OR s.is_active IS NULL) 
         AND s.email IS NOT NULL AND s.email != ''`,
      [session.class_id]
    );
    const attendees = emailsRes.rows.map(r => ({ email: r.email, displayName: r.full_name }));
    const summaryText = session.class_name ? `[${session.class_name}] ${session.content || 'Lịch học'}` : (session.content || 'Lịch học');
    const descriptionText = `Lớp: ${session.class_name || 'Lớp học'}\nNội dung: ${session.content || 'Buổi học theo chương trình'}\nThời gian: ${startT} - ${endT}\nGiáo viên: ${userResult.rows[0]?.full_name || 'Giáo viên'}`;

    let eventId = session.google_event_id;
    let htmlLink = '';

    try {
      if (eventId) {
        try {
          const patchRes = await calendar.events.patch({
            calendarId: 'primary',
            eventId: eventId,
            sendUpdates: attendees.length > 0 ? 'all' : 'none',
            requestBody: {
              summary: summaryText,
              description: descriptionText,
              start: { dateTime: `${dateStr}T${startT}+07:00`, timeZone: 'Asia/Ho_Chi_Minh' },
              end: { dateTime: `${dateStr}T${endT}+07:00`, timeZone: 'Asia/Ho_Chi_Minh' },
              status: 'confirmed',
              attendees: attendees.length > 0 ? attendees : undefined
            }
          });
          eventId = patchRes.data.id;
          htmlLink = patchRes.data.htmlLink || '';
        } catch (patchErr: any) {
          if (patchErr?.code === 404 || patchErr?.message?.includes('Not Found')) {
            console.warn('Sự kiện cũ không còn tồn tại trên Google Calendar, tiến hành tạo mới...');
            eventId = null;
          } else {
            throw patchErr;
          }
        }
      }

      if (!eventId) {
        const insertRes = await calendar.events.insert({
          calendarId: 'primary',
          sendUpdates: attendees.length > 0 ? 'all' : 'none',
          requestBody: {
            summary: summaryText,
            description: descriptionText,
            start: { dateTime: `${dateStr}T${startT}+07:00`, timeZone: 'Asia/Ho_Chi_Minh' },
            end: { dateTime: `${dateStr}T${endT}+07:00`, timeZone: 'Asia/Ho_Chi_Minh' },
            status: 'confirmed',
            attendees: attendees.length > 0 ? attendees : undefined
          }
        });
        eventId = insertRes.data.id;
        htmlLink = insertRes.data.htmlLink || '';
        await pool.query('UPDATE sessions SET google_event_id = $1 WHERE id = $2', [eventId, session.id]);
      }

      // POST-SYNC VERIFICATION (P0)
      const verifyRes = await calendar.events.get({
        calendarId: 'primary',
        eventId: eventId as string
      });

      if (!verifyRes.data || verifyRes.data.status === 'cancelled') {
        throw new Error('Google Calendar chưa xác nhận sự kiện. Vui lòng thử lại.');
      }

      htmlLink = verifyRes.data.htmlLink || htmlLink || `https://calendar.google.com/calendar/r/eventedit/${eventId}`;

      res.status(200).json({ 
        success: true,
        message: 'Đồng bộ buổi học vào Google Calendar thành công!',
        event_id: eventId,
        html_link: htmlLink,
        calendar_id: 'primary',
        calendar_account: googleEmail || undefined,
        attendees_count: attendees.length
      });
    } catch (googleApiErr: any) {
      console.error("Google API Error in syncCalendar:", googleApiErr);
      const errMsg = googleApiErr?.message || '';
      const status = googleApiErr?.status || googleApiErr?.code || googleApiErr?.response?.status;
      
      if (errMsg.includes('invalid_grant') || status === 401) {
        res.status(401).json({ message: 'Phiên đăng nhập Google Calendar đã hết hạn. Vui lòng bấm "Tích hợp Google Calendar" để cấp lại quyền.' });
        return;
      }
      if (status === 403 || errMsg.includes('quota') || errMsg.includes('insufficientPermissions')) {
        res.status(403).json({ message: 'Tài khoản Google chưa được cấp quyền ghi Lịch hoặc đã vượt hạn mức gọi Google API.' });
        return;
      }
      if (status === 404) {
        res.status(502).json({ message: 'Không tìm thấy Lịch mặc định (Primary Calendar) trên tài khoản Google của bạn.' });
        return;
      }
      if (errMsg.includes('ENOTFOUND') || errMsg.includes('ETIMEDOUT') || errMsg.includes('ECONNRESET')) {
        res.status(502).json({ message: 'Không thể kết nối đến máy chủ Google Calendar. Vui lòng kiểm tra kết nối mạng.' });
        return;
      }
      res.status(502).json({ message: `Google Calendar trả về lỗi: ${errMsg || 'Không thể đồng bộ'}` });
      return;
    }
  } catch (error: any) {
    console.error("Database or Server Error in syncCalendar:", error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ khi xử lý đồng bộ Calendar' });
  }
};
