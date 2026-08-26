import { Request, Response } from 'express';
import pool from '../db';
import { google } from 'googleapis';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'dummy_id';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'dummy_secret';
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://quanlydaythem-api.onrender.com/api/calendar/callback';

import { AuthRequest } from '../middleware/authMiddleware';

// 1. Lấy danh sách lớp học (GET)
export const getClasses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ message: "Không tìm thấy thông tin xác thực!" });
      return;
    }

    let result;
    if (user.role === 'ADMIN') {
      result = await pool.query('SELECT * FROM classes WHERE is_active = TRUE OR is_active IS NULL ORDER BY id DESC');
    } else {
      result = await pool.query(
        'SELECT * FROM classes WHERE teacher_id = $1 AND (is_active = TRUE OR is_active IS NULL) ORDER BY id DESC', 
        [user.id]
      );
    }
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Lỗi khi lấy danh sách lớp học:", error);
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

export const getClass = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user;
    const result = await pool.query('SELECT * FROM classes WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ message: "Không tìm thấy lớp học" });
      return;
    }
    const classData = result.rows[0];
    if (user && user.role === 'TEACHER' && classData.teacher_id !== user.id) {
      res.status(403).json({ message: "Bạn không có quyền xem lớp học này." });
      return;
    }
    res.status(200).json(classData);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server" });
  }
};

// 2. Thêm lớp học mới (POST) - Cập nhật Schema Lõi
export const createClass = async (req: AuthRequest, res: Response): Promise<void> => {
  const { class_name, name, description, class_type, meet_link, schedule, tuition_fee } = req.body; 
  const finalName = class_name || name;
  const teacherId = req.user?.id;
  
  if (!finalName) {
    res.status(400).json({ message: 'Tên lớp học là bắt buộc' });
    return;
  }
  
  try {
    const result = await pool.query(
      'INSERT INTO classes (class_name, description, teacher_id, class_type, meet_link, schedule, tuition_fee) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [finalName, description || null, teacherId, class_type || 'OFFLINE', meet_link || null, schedule || null, tuition_fee || null] 
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Lỗi createClass:', error);
    res.status(500).json({ message: 'Lỗi server khi tạo lớp' });
  }
};

export const updateClass = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { class_name, description, teacher_id, class_type, meet_link } = req.body; 
  try {
    await pool.query(
      `UPDATE classes SET class_name = $1, description = $2, teacher_id = $3, class_type = $4, meet_link = $5 WHERE id = $6`,
      [class_name, description, teacher_id || null, class_type || 'OFFLINE', meet_link || null, id]
    );
    res.status(200).json({ message: "Cập nhật thành công" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server" });
  }
};

// 4. Xóa lớp học (DELETE)
export const deleteClass = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    try { await pool.query('ALTER TABLE classes ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE'); } catch(e){}
    try { await pool.query('UPDATE classes SET is_active = TRUE WHERE is_active IS NULL'); } catch(e){}

    const result = await pool.query('UPDATE classes SET is_active = FALSE WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ message: "Không tìm thấy lớp học" });
      return;
    }
    res.status(200).json({ message: "Đã xóa (ẩn) lớp học thành công" });
  } catch (error: any) {
    console.error('Lỗi xóa lớp:', error);
    res.status(500).json({ message: "Lỗi máy chủ nội bộ", details: error.message });
  }
};

// 5. Gán giáo viên cho lớp học
export const assignTeacher = async (req: Request, res: Response): Promise<void> => {
  try {
    const classId = req.params.id;
    const { teacher_id } = req.body;
    const result = await pool.query(
      'UPDATE classes SET teacher_id = $1 WHERE id = $2 RETURNING *',
      [teacher_id, classId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ message: 'Không tìm thấy lớp học' });
      return;
    }
    res.status(200).json({ message: 'Đã phân công giáo viên thành công!', class: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi máy chủ' });
  }
};

// ==========================================
// API MỚI CHO PHASE 1 - CORE
// ==========================================

export const getClassMembers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT s.id, s.full_name, s.phone_number AS phone FROM students s JOIN enrollments cm ON s.id = cm.student_id WHERE cm.class_id = $1 ORDER BY s.full_name',
      [id]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Lỗi get class members:", error);
    res.status(500).json({ error: "Lỗi khi lấy danh sách học sinh" });
  }
};

export const getClassSessions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT * FROM sessions WHERE class_id = $1 ORDER BY session_date DESC`,
      [id]
    );
    console.log(`[getClassSessions] class_id=${id}, result length=${result.rows.length}`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
};

export const getSessionAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // session_id
    // 1. Get session info
    const sessionRes = await pool.query('SELECT class_id, session_date FROM sessions WHERE id = $1', [id]);
    if (sessionRes.rows.length === 0) {
      res.status(404).json({ message: "Không tìm thấy buổi học" });
      return;
    }
    const { class_id, session_date } = sessionRes.rows[0];

    // 2. Query attendance
    const result = await pool.query(
      `SELECT a.*, s.full_name, s.id as student_code
       FROM attendance a 
       JOIN students s ON a.student_id = s.id 
       WHERE a.class_id = $1 AND a.attendance_date = $2 ORDER BY s.full_name`,
      [class_id, session_date]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
};

// POST /api/classes/:id/members
export const addMember = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params; // class_id
  const { student_id } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO class_members (class_id, student_id) VALUES ($1, $2) RETURNING *`,
      [id, student_id]
    );
    res.status(201).json({ message: "Đã thêm học sinh vào lớp", member: result.rows[0] });
  } catch (error: any) {
    if (error.code === '23505') { // Unique violation
      res.status(400).json({ message: "Học sinh đã có trong lớp này" });
      return;
    }
    console.error(error);
    res.status(500).json({ message: "Lỗi server khi thêm học sinh" });
  }
};

// POST /api/classes/:id/sessions
export const createSession = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params; // class_id
  const { session_date, start_time, end_time, content } = req.body;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Tạo buổi học
    const sessionRes = await client.query(
      `INSERT INTO sessions (class_id, session_date, start_time, end_time, content) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, session_date, start_time, end_time, content]
    );
    const session = sessionRes.rows[0];

    // Google Calendar Sync
    try {
      const teacherId = (req as any).user?.id;
      if (teacherId) {
        const userResult = await client.query('SELECT google_calendar_tokens FROM users WHERE id = $1', [teacherId]);
        const tokens = userResult.rows[0]?.google_calendar_tokens;
        if (tokens) {
          const parsedTokens = typeof tokens === 'string' ? JSON.parse(tokens) : tokens;
          const userOAuth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI);
          userOAuth2Client.setCredentials(parsedTokens);
          const calendar = google.calendar({ version: 'v3', auth: userOAuth2Client });
          
          // Get students emails
          const emailsRes = await client.query(
            `SELECT s.email FROM students s
             JOIN class_members cm ON s.id = cm.student_id
             WHERE cm.class_id = $1 AND cm.status = 'ACTIVE' AND s.is_active = true AND s.email IS NOT NULL`,
            [id]
          );
          const attendees = emailsRes.rows.map(r => ({ email: r.email }));
          
          const event = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: {
              summary: content || 'Lịch học',
              start: { dateTime: session_date + 'T' + (start_time || '18:00') + ':00+07:00', timeZone: 'Asia/Ho_Chi_Minh' },
              end: { dateTime: session_date + 'T' + (end_time || '19:30') + ':00+07:00', timeZone: 'Asia/Ho_Chi_Minh' },
              attendees: attendees.length > 0 ? attendees : undefined
            }
          });
          
          await client.query('UPDATE sessions SET google_event_id = $1 WHERE id = $2', [event.data.id, session.id]);
        }
      }
    } catch (googleErr) {
      console.error("Lỗi đồng bộ Google Calendar khi tạo buổi học:", googleErr);
      // KHÔNG rollback session, chỉ log lỗi
    }

    // 2. Lấy danh sách học sinh đang có trong lớp
    const membersRes = await client.query(
      `SELECT student_id FROM class_members WHERE class_id = $1 AND status = 'ACTIVE'`,
      [id]
    );

    // 3. Tự động sinh danh sách điểm danh với status = 'PRESENT'
    for (const member of membersRes.rows) {
      await client.query(
        `INSERT INTO attendance (session_id, student_id, status) VALUES ($1, $2, 'PRESENT')`,
        [session.id, member.student_id]
      );
    }
    
    await client.query('COMMIT');
    res.status(201).json({ message: "Tạo buổi học thành công", session });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ message: "Lỗi server khi tạo buổi học" });
  } finally {
    client.release();
  }
};

// PUT /api/sessions/:id/attendance (Được định tuyến qua classRoutes hoặc sessionRoutes)
export const updateAttendance = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params; // session_id
  const { student_id, status, note } = req.body;
  try {
    // 1. Lấy thông tin session
    const sessionRes = await pool.query('SELECT class_id, session_date FROM sessions WHERE id = $1', [id]);
    if (sessionRes.rows.length === 0) {
      res.status(404).json({ message: "Không tìm thấy buổi học" });
      return;
    }
    const { class_id, session_date } = sessionRes.rows[0];

    // 2. Upsert điểm danh do không có session_id
    const checkRes = await pool.query(
      'SELECT id FROM attendance WHERE class_id = $1 AND attendance_date = $2 AND student_id = $3',
      [class_id, session_date, student_id]
    );

    let result;
    if (checkRes.rows.length > 0) {
      result = await pool.query(
        `UPDATE attendance SET status = $1, notes = $2 
         WHERE class_id = $3 AND attendance_date = $4 AND student_id = $5 RETURNING *`,
        [status, note, class_id, session_date, student_id]
      );
    } else {
      result = await pool.query(
        `INSERT INTO attendance (class_id, attendance_date, student_id, status, notes) 
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [class_id, session_date, student_id, status, note]
      );
    }

    res.status(200).json({ message: "Cập nhật điểm danh thành công", attendance: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server khi cập nhật điểm danh" });
  }
};