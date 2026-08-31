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

export const searchGlobalStudents = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { q } = req.query;
        if (!q || typeof q !== 'string' || q.trim().length === 0) {
            res.status(200).json([]);
            return;
        }
        
        const trimmed = q.trim();
        const query = `
            SELECT id, full_name, phone_number, school_name, email
            FROM students 
            WHERE (is_active = TRUE OR is_active IS NULL)
            AND (full_name ILIKE $1 OR phone_number ILIKE $1 OR email ILIKE $1)
            ORDER BY full_name ASC LIMIT 20
        `;
        
        const result = await pool.query(query, [`%${trimmed}%`]);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Lỗi tìm kiếm học sinh" });
    }
};

export const getStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, grade } = req.query;
    let query = 'SELECT DISTINCT s.* FROM students s ';
    const values: any[] = [];
    let count = 1;
    
    if (req.user && req.user.role === 'TEACHER') {
        query += ' LEFT JOIN enrollments e ON s.id = e.student_id LEFT JOIN classes c ON e.class_id = c.id WHERE (c.teacher_id = $' + count + ' OR s.teacher_id = $' + count + ') AND (s.is_active = TRUE OR s.is_active IS NULL) ';
        values.push(req.user.id);
        count++;
    } else {
        query += ' WHERE (s.is_active = TRUE OR s.is_active IS NULL) ';
    }

    if (search) {
      query += ` AND s.full_name ILIKE $${count}`;
      values.push(`%${search}%`);
      count++;
    }

    if (grade && grade !== 'ALL') {
      query += ` AND s.grade = $${count}`;
      values.push(grade);
      count++;
    }

    query += ' ORDER BY s.created_at DESC';

    const result = await pool.query(query, values);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

// THÊM HỌC SINH MỚI
export const createStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  const { full_name, date_of_birth, phone_number, school_name, notes, email, password } = req.body;
  const user = req.user;

  try {
    const passwordHash = await bcrypt.hash(password || '123456', 10);
    const username = phone_number;

    const result = await pool.query(
      `INSERT INTO students (
        full_name, date_of_birth, phone_number, school_name, notes,
        email, teacher_id, username, password
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        full_name,
        date_of_birth || null,
        phone_number,
        school_name || null,
        notes || null,
        email || null,
        user?.id || null,
        username,
        passwordHash
      ]
    );

    const student = result.rows[0];

    try {
      await pool.query(
        `INSERT INTO users (username, password_hash, role, full_name, student_id) VALUES ($1, $2, $3, $4, $5)`,
        [username, passwordHash, 'STUDENT', full_name, student.id]
      );
    } catch (e) {
      console.log('Không thể tạo user tự động cho học sinh:', e);
    }

    res.status(201).json({
      message: 'Thêm học sinh thành công',
      student: student
    });
  } catch (error: any) {
    console.error('Lỗi tạo học sinh:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};

export const getProfile360 = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const studentRes = await pool.query('SELECT * FROM students WHERE id = $1', [id]);
    if (studentRes.rows.length === 0) {
      res.status(404).json({ message: 'Không tìm thấy học sinh' });
      return;
    }
    const student = studentRes.rows[0];

    const classRes = await pool.query(
      'SELECT c.class_name, c.schedule, c.meet_link FROM enrollments e JOIN classes c ON e.class_id = c.id WHERE e.student_id = $1 AND e.status = \'ACTIVE\'',
      [id]
    );

    const attendRes = await pool.query(
      'SELECT status, count(*) FROM attendance WHERE student_id = $1 GROUP BY status',
      [id]
    );

    const scoresRes = await pool.query(
      'SELECT document_id, total_score, submitted_at FROM exam_submissions WHERE student_id = $1 ORDER BY submitted_at DESC LIMIT 5',
      [id]
    );

    res.status(200).json({
      student,
      classes: classRes.rows,
      attendance: attendRes.rows,
      recent_scores: scoresRes.rows,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server' });
  }
};

export const updateStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { full_name, phone, phone_number, parent_phone, school, school_name, grade, current_level, email } = req.body;
  try {
    const phoneToUse = phone_number || phone;
    const schoolToUse = school_name || school;
    const result = await pool.query(
      'UPDATE students SET full_name = $1, phone_number = $2, parent_phone = $3, school_name = $4, school = $4, grade = $5, current_level = $6, email = $7 WHERE id = $8 RETURNING *',
      [full_name, phoneToUse, parent_phone, schoolToUse, grade, current_level, email || null, id]
    );
    res.status(200).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

export const deleteStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
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
        if (req.user?.role === 'STUDENT') {
            res.status(403).json({ message: "Học sinh không có quyền truy cập tính năng phân tích của giáo viên." });
            return;
        }

        if (req.user?.role === 'TEACHER') {
            const check = await pool.query(
                `SELECT 1 FROM students s
                 LEFT JOIN enrollments e ON s.id = e.student_id
                 LEFT JOIN classes c ON e.class_id = c.id
                 WHERE s.id = $1 AND (s.teacher_id = $2 OR c.teacher_id = $2)`,
                [id, req.user.id]
            );
            if (check.rows.length === 0) {
                res.status(403).json({ message: "Không có quyền phân tích học sinh này" });
                return;
            }
        }

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
