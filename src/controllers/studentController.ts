import { generateWithFallback } from '../services/geminiService';
import { Request, Response } from 'express';
import pool from '../db';
import bcrypt from 'bcrypt';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: string;
    student_id?: number;
  };
}

// LẤY DANH SÁCH HỌC SINH (HỖ TRỢ SEARCH & LỌC KHỐI)
export const getStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, grade } = req.query;
    let query = 'SELECT * FROM students WHERE (is_active = TRUE OR is_active IS NULL)';
    const values: any[] = [];
    let count = 1;

    if (search) {
      query += ` AND full_name ILIKE $${count}`;
      values.push(`%${search}%`);
      count++;
    }

    if (grade && grade !== 'ALL') {
      query += ` AND grade = $${count}`;
      values.push(grade);
      count++;
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, values);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

// THÊM HỌC SINH MỚI
export const createStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  let { student_code, full_name, phone, parent_phone, school, grade, current_level, phone_number } = req.body;
  const user = req.user;

  if (!student_code) {
    student_code = 'HS' + Date.now().toString().slice(-6);
  }
  const phoneToUse = phone || phone_number || '';

  try {
    const result = await pool.query(
      `INSERT INTO students (student_code, full_name, phone_number, parent_phone, school, grade, current_level) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [student_code, full_name, phoneToUse, parent_phone, school, grade, current_level]
    );

    const student = result.rows[0];

    // Tạo tài khoản đăng nhập cho học sinh (Role = 'STUDENT')
    try {
      const username = phoneToUse || student_code;
      const email = `${username.toLowerCase()}@student.local`; // Cần cho DB schema cũ nếu email NOT NULL
      const passwordHash = await bcrypt.hash('123456', 10);
      
      // Kiểm tra cột username trong users
      try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(255) UNIQUE;`); } catch(e){}

      await pool.query(
        `INSERT INTO users (username, email, password_hash, role, full_name, student_id) VALUES ($1, $2, $3, $4, $5, $6)`,
        [username, email, passwordHash, 'STUDENT', full_name, student.id]
      );
    } catch (e) {
      console.log('Không thể tạo user tự động cho học sinh:', e);
    }

    res.status(201).json({
      message: 'Thêm học sinh thành công',
      student: student
    });
  } catch (error: any) {
    // Fallback cho schema cũ nếu initCore.sql chưa được chạy hoàn chỉnh
    try {
      const username = phoneToUse || student_code;
      const hashedPassword = await bcrypt.hash('123456', 10);
      const fallback = await pool.query(
        `INSERT INTO students (full_name, phone_number, username, password, teacher_id) 
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [full_name, phoneToUse, username, hashedPassword, user?.id || null]
      );
      res.status(201).json({
        message: 'Thêm học sinh thành công (schema cũ)',
        student: fallback.rows[0]
      });
    } catch(e) {
      console.error(error, e);
      res.status(500).json({ message: 'Lỗi server khi thêm học sinh' });
    }
  }
};

// HỒ SƠ 360°
export const getProfile360 = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    // 1. Thông tin cá nhân
    const studentRes = await pool.query('SELECT id, full_name, phone_number AS phone, school_name AS school, is_active AS status, learning_goals, COALESCE(ai_evaluation, \'null\'::jsonb) AS ai_evaluation FROM students WHERE id = $1', [id]);
    if (studentRes.rows.length === 0) {
      res.status(404).json({ message: "Không tìm thấy học sinh" });
      return;
    }
    const student = studentRes.rows[0];

    // 2. Danh sách lớp
    const classesRes = await pool.query(
      `SELECT c.*, e.enrollment_date as enroll_date, e.status as member_status 
       FROM enrollments e 
       JOIN classes c ON e.class_id = c.id 
       WHERE e.student_id = $1`,
      [id]
    );

    // 3. Thống kê chuyên cần
    const attendanceRes = await pool.query(
      `SELECT status, COUNT(*) as count 
       FROM attendance 
       WHERE student_id = $1 
       GROUP BY status`,
      [id]
    );

    let total_sessions = 0;
    let present = 0;
    let late = 0;
    let absent = 0;

    attendanceRes.rows.forEach(row => {
      const cnt = parseInt(row.count);
      total_sessions += cnt;
      if (row.status === 'PRESENT') present += cnt;
      else if (row.status === 'LATE') late += cnt;
      else if (row.status === 'ABSENT_EXCUSED' || row.status === 'ABSENT_UNEXCUSED') absent += cnt;
    });

    res.json({
      profile: student,
      classes: classesRes.rows,
      attendance: {
        total: total_sessions,
        present,
        late,
        absent,
        rate: total_sessions > 0 ? Math.round(((present + late) / total_sessions) * 100) : 0
      }
    });

  } catch (error) {
    console.error('Lỗi get profile360:', error);
      res.status(500).json({ message: 'Lỗi server' });
  }
};

export const updateStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params; 
  const { full_name, phone, parent_phone, school, grade, current_level } = req.body; 
  try {
    const result = await pool.query(
      'UPDATE students SET full_name = $1, phone_number = $2, parent_phone = $3, school = $4, grade = $5, current_level = $6 WHERE id = $7 RETURNING *',
      [full_name, phone, parent_phone, school, grade, current_level, id]
    );
    res.status(200).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

export const deleteStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    try { await pool.query('ALTER TABLE students ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE'); } catch(e){}
    try { await pool.query('UPDATE students SET is_active = TRUE WHERE is_active IS NULL'); } catch(e){}

    await pool.query('UPDATE students SET is_active = FALSE WHERE id = $1', [id]);
    res.status(200).json({ message: "Đã xóa (ẩn) học sinh thành công" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

export const updateStudentGoals = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { learning_goals } = req.body;
  try {
    const result = await pool.query(
      'UPDATE students SET learning_goals = $1 WHERE id = $2 RETURNING learning_goals',
      [learning_goals, id]
    );
    res.status(200).json({ message: 'Cập nhật mục tiêu thành công', learning_goals: result.rows[0].learning_goals });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};

export const resetStudentPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const studentId = req.params.id;
    const { newPassword } = req.body;

    if (!newPassword) {
      res.status(400).json({ message: 'Mật khẩu mới không được để trống' });
      return;
    }

    const passwordHash = await require('bcrypt').hash(newPassword, 10);
    const result = await pool.query(
      `UPDATE users SET password_hash = $1 WHERE student_id = $2 AND role = 'STUDENT' RETURNING id`,
      [passwordHash, studentId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Không tìm thấy tài khoản đăng nhập của học sinh này' });
      return;
    }

    res.status(200).json({ message: 'Đổi mật khẩu học sinh thành công' });
  } catch (error: any) {
    console.error('Lỗi đổi mật khẩu học sinh:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};


export const generateAIEvaluation = async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
        // 1. Get student profile
        const studentRes = await pool.query('SELECT full_name, school_name, is_active FROM students WHERE id = $1', [id]);
        if (studentRes.rows.length === 0) {
            res.status(404).json({ message: "Không tìm thấy học sinh" });
            return;
        }
        const student = studentRes.rows[0];

        // 2. Get recent exams
        const examsRes = await pool.query(`
            SELECT total_score, time_taken_seconds, topic_performance 
            FROM exam_submissions 
            WHERE student_id = $1 AND status = 'COMPLETED'
            ORDER BY submitted_at DESC 
            LIMIT 5
        `, [id]);
        
        let examsContext = 'Học sinh chưa làm bài tập/thi nào.';
        if (examsRes.rows.length > 0) {
            examsContext = examsRes.rows.map((e, idx) => {
                let perfStr = 'Không có dữ liệu dạng bài';
                if (e.topic_performance) {
                   perfStr = JSON.stringify(e.topic_performance);
                }
                return `Bài ${idx + 1}: Điểm ${e.total_score} - Thời gian ${e.time_taken_seconds}s - Thống kê: ${perfStr}`;
            }).join('\n');
        }

        // 3. Get attendance
        const attendanceRes = await pool.query('SELECT status, COUNT(*) as count FROM attendance WHERE student_id = $1 GROUP BY status', [id]);
        let total_sessions = 0;
        let present = 0;
        attendanceRes.rows.forEach(row => {
            const cnt = parseInt(row.count);
            total_sessions += cnt;
            if (row.status === 'PRESENT') present += cnt;
        });
        const attRate = total_sessions > 0 ? Math.round((present / total_sessions) * 100) : 0;

        // 4. Construct Prompt
        const prompt = `Bạn là một giáo viên tận tâm. Dựa vào dữ liệu học tập sau của học sinh ${student.full_name} (Trường: ${student.school_name || 'Không rõ'}, Trạng thái: ${student.is_active ? 'Đang học' : 'Nghỉ học'}):
Tỷ lệ đi học: ${total_sessions > 0 ? `${attRate}% (${present}/${total_sessions} buổi)` : 'Chưa có dữ liệu điểm danh'}
Lịch sử làm bài (gần nhất):
${examsContext}

Hãy phân tích và trả về DUY NHẤT một chuỗi JSON chuẩn xác (không bọc trong markdown tick) với cấu trúc:
{ "strong_points": ["..."], "weak_points": ["..."], "attention_note": "...", "action_plan": "...", "analyzed_at": "YYYY-MM-DD" }`;

        // 5. Call AI
        let aiText = await generateWithFallback(prompt);
        // Clean markdown backticks if AI ignores prompt instructions
        aiText = aiText.replace(/\s*```json\s*/g, '').replace(/\s*```\s*/g, '').trim();

        const parsedAIResponse = JSON.parse(aiText);
        // Add analyzed_at if missing
        if (!parsedAIResponse.analyzed_at) {
            parsedAIResponse.analyzed_at = new Date().toISOString().split('T')[0];
        }

        // 6. Save to DB
        await pool.query('UPDATE students SET ai_evaluation = $1 WHERE id = $2', [JSON.stringify(parsedAIResponse), id]);

        res.status(200).json({ message: "Phân tích thành công", data: parsedAIResponse, ai_evaluation: parsedAIResponse });
    } catch (error) {
        console.error('Lỗi generateAIEvaluation:', error);
        res.status(500).json({ message: 'Lỗi server khi phân tích AI' });
    }
};
