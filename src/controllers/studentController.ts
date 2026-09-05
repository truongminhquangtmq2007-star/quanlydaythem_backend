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

    // 1. Phân quyền: Học sinh không được xem profile360 tùy tiện
    if (req.user?.role === 'STUDENT') {
      res.status(403).json({ message: "Học sinh không có quyền truy cập hồ sơ giáo viên." });
      return;
    }

    // Giáo viên chỉ được xem học sinh thuộc lớp họ dạy hoặc do họ quản lý
    if (req.user?.role === 'TEACHER') {
      const check = await pool.query(
        `SELECT 1 FROM students s
         LEFT JOIN enrollments e ON s.id = e.student_id
         LEFT JOIN classes c ON e.class_id = c.id
         WHERE s.id = $1 AND (s.teacher_id = $2 OR c.teacher_id = $2)`,
        [id, req.user.id]
      );
      if (check.rows.length === 0) {
        res.status(403).json({ message: "Không có quyền truy cập học sinh này" });
        return;
      }
    }

    const studentRes = await pool.query('SELECT * FROM students WHERE id = $1', [id]);
    if (studentRes.rows.length === 0) {
      res.status(404).json({ message: 'Không tìm thấy học sinh' });
      return;
    }
    const student = studentRes.rows[0];

    // 2. Lớp học của học sinh (hỗ trợ cả 'Đang học' và 'ACTIVE')
    const classRes = await pool.query(
      `SELECT c.id, c.class_name, c.class_name as name, c.schedule, c.meet_link, COALESCE(e.status, 'Đang học') as member_status, COALESCE(c.class_type, 'Lớp dạy kèm') as subject, c.class_type
       FROM enrollments e 
       JOIN classes c ON e.class_id = c.id 
       WHERE e.student_id = $1 AND (e.status IS NULL OR e.status IN ('ACTIVE', 'Đang học', 'active'))`,
      [id]
    );

    // 3. Tính toán chuyên cần dạng tổng hợp canonical { total, present, late, absent, rate }
    const attendRes = await pool.query(
      'SELECT status, count(*)::int as count FROM attendance WHERE student_id = $1 GROUP BY status',
      [id]
    );
    let total = 0;
    let present = 0;
    let late = 0;
    let absent = 0;

    for (const row of attendRes.rows) {
      const cnt = parseInt(row.count) || 0;
      total += cnt;
      const st = String(row.status || '').toUpperCase();
      if (st === 'PRESENT' || st === 'CÓ MẶT') {
        present += cnt;
      } else if (st === 'LATE' || st === 'MUỘN' || st === 'ĐI MUỘN') {
        late += cnt;
      } else if (st.includes('ABSENT') || st.includes('VẮNG') || st.includes('NGHỈ')) {
        absent += cnt;
      }
    }
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    const attendance = { total, present, late, absent, rate };

    // 4. Lịch sử bài thi đã hoàn thành (COMPLETED)
    const scoresRes = await pool.query(
      `SELECT es.id, es.document_id, COALESCE(d.title, 'Bài thi') as exam_title, es.total_score, es.submitted_at, es.time_taken_seconds
       FROM exam_submissions es
       LEFT JOIN documents d ON es.document_id = d.id
       WHERE es.student_id = $1 AND es.status = 'COMPLETED'
       ORDER BY es.submitted_at DESC 
       LIMIT 5`,
      [id]
    );

    // 5. Thống kê chuyên đề (Topic Mastery)
    let topics: any[] = [];
    const topicsRes = await pool.query(
      `SELECT 
         TRIM(topic_name) as topic, 
         SUM(total_questions)::int as total_questions, 
         SUM(correct_answers)::int as correct_answers,
         ROUND(CAST(SUM(correct_answers) AS NUMERIC) * 100.0 / NULLIF(SUM(total_questions), 0), 1) as accuracy_rate
       FROM student_topic_performance 
       WHERE student_id = $1 
       GROUP BY TRIM(topic_name)
       HAVING SUM(total_questions) > 0
       ORDER BY accuracy_rate DESC, total_questions DESC`,
      [id]
    );

    if (topicsRes.rows.length > 0) {
      topics = topicsRes.rows.map((t, idx) => ({
        id: idx + 1,
        topic: t.topic,
        total_questions: Number(t.total_questions || 0),
        correct_answers: Number(t.correct_answers || 0),
        accuracy_rate: Math.round(Number(t.accuracy_rate || 0)),
        attempt_count: Number(t.total_questions || 0),
        correct_count: Number(t.correct_answers || 0)
      }));
    } else {
      const jsonbRes = await pool.query(
        `SELECT topic_performance FROM exam_submissions WHERE student_id = $1 AND status = 'COMPLETED' AND topic_performance IS NOT NULL LIMIT 20`,
        [id]
      );
      if (jsonbRes.rows.length > 0) {
        const aggregate: Record<string, { correct: number; total: number }> = {};
        for (const row of jsonbRes.rows) {
          const tp = row.topic_performance as Record<string, any>;
          for (const [topic, data] of Object.entries(tp || {})) {
            const cleanTopic = String(topic).trim();
            if (!aggregate[cleanTopic]) aggregate[cleanTopic] = { correct: 0, total: 0 };
            aggregate[cleanTopic].correct += Number(data.correct || data.corrects || 0);
            aggregate[cleanTopic].total += Number(data.total || data.attempts || 0);
          }
        }
        topics = Object.entries(aggregate).map(([topic_name, stats], idx) => ({
          id: idx + 1,
          topic: topic_name,
          total_questions: stats.total,
          correct_answers: stats.correct,
          accuracy_rate: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
          attempt_count: stats.total,
          correct_count: stats.correct
        }));
      }
    }

    // 6. Đọc kết quả đánh giá AI đã lưu (nếu có)
    let aiEvaluation = null;
    if (student.ai_evaluation) {
      try {
        aiEvaluation = typeof student.ai_evaluation === 'string' ? JSON.parse(student.ai_evaluation) : student.ai_evaluation;
      } catch (parseErr) {
        aiEvaluation = student.ai_evaluation;
      }
    }

    res.status(200).json({
      student: {
        ...student,
        school: student.school_name || student.school || '',
        phone: student.phone_number || student.phone || '',
        student_code: student.student_code || `#${student.id}`
      },
      classes: classRes.rows,
      attendance,
      recent_scores: scoresRes.rows,
      topics,
      ai_evaluation: aiEvaluation
    });
  } catch (error) {
    console.error("LỖI getProfile360:", error);
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
