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
    let query = 'SELECT * FROM students WHERE 1=1';
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
      const email = `${student_code.toLowerCase()}@minhquang.edu.vn`;
      const passwordHash = await bcrypt.hash(phoneToUse || '123456', 10);
      await pool.query(
        `INSERT INTO users (email, password_hash, role, full_name, student_id) VALUES ($1, $2, $3, $4, $5)`,
        [email, passwordHash, 'STUDENT', full_name, student.id]
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
    const studentRes = await pool.query('SELECT id, full_name, phone_number AS phone, parent_phone, school, grade, current_level, status, learning_goals FROM students WHERE id = $1', [id]);
    if (studentRes.rows.length === 0) {
      res.status(404).json({ message: "Không tìm thấy học sinh" });
      return;
    }
    const student = studentRes.rows[0];

    // 2. Danh sách lớp
    const classesRes = await pool.query(
      `SELECT c.*, cm.enroll_date, cm.status as member_status 
       FROM class_members cm 
       JOIN classes c ON cm.class_id = c.id 
       WHERE cm.student_id = $1`,
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
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
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
    await pool.query('DELETE FROM students WHERE id = $1', [id]);
    res.status(200).json({ message: "Đã xóa học sinh thành công" });
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
