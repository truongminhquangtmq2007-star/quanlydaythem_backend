import { Request, Response } from 'express';
import pool from '../db';
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

export const getClass = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM classes WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ message: "Không tìm thấy lớp học" });
      return;
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server" });
  }
};

// 2. Thêm lớp học mới (POST) - Cập nhật Schema Lõi
export const createClass = async (req: AuthRequest, res: Response): Promise<void> => {
  const { class_code, name, class_name, subject, grade, max_students, teacher_id, description, class_type, meet_link } = req.body; 
  const finalName = name || class_name; // Hỗ trợ cả ứng dụng cũ (class_name)
  
  try {
    // Cố gắng insert với Schema mới (PHASE 1 CORE)
    const result = await pool.query(
      `INSERT INTO classes (class_code, name, subject, grade, teacher_id, max_students, class_type, meet_link) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [class_code, finalName, subject, grade, teacher_id || null, max_students || 20, class_type || 'OFFLINE', meet_link || null] 
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    // Fallback: Nếu CSDL chưa chạy lệnh initCore (thiếu cột), thử insert theo schema cũ
    try {
      const fallback = await pool.query(
        `INSERT INTO classes (class_name, description, teacher_id) VALUES ($1, $2, $3) RETURNING *`,
        [finalName, description, teacher_id || null] 
      );
      res.status(201).json(fallback.rows[0]);
    } catch(e) {
      console.error(error, e);
      res.status(500).json({ message: "Lỗi server khi tạo lớp" });
    }
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
      `SELECT cm.*, s.full_name, s.student_code, s.phone 
       FROM class_members cm 
       JOIN students s ON cm.student_id = s.id 
       WHERE cm.class_id = $1 ORDER BY s.full_name`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
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
    const result = await pool.query(
      `SELECT a.*, s.full_name, s.student_code 
       FROM attendance a 
       JOIN students s ON a.student_id = s.id 
       WHERE a.session_id = $1 ORDER BY s.full_name`,
      [id]
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
    const result = await pool.query(
      `UPDATE attendance SET status = $1, note = $2 
       WHERE session_id = $3 AND student_id = $4 RETURNING *`,
      [status, note, id, student_id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ message: "Không tìm thấy bản ghi điểm danh" });
      return;
    }
    res.status(200).json({ message: "Cập nhật điểm danh thành công", attendance: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server khi cập nhật điểm danh" });
  }
};