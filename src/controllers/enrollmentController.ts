import { Request, Response } from 'express';
import pool from '../db';
import { AuthRequest } from '../middleware/authMiddleware';

// 1. Xem danh sách đã xếp lớp (GET) - Dùng JOIN để lấy tên thật thay vì chỉ lấy ID
export const getEnrollments = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    let query: string;
    let params: any[] = [];

    if (user?.role === 'ADMIN') {
      query = `
        SELECT e.id, s.full_name, c.class_name, e.enrollment_date, e.status
        FROM enrollments e
        JOIN students s ON e.student_id = s.id
        JOIN classes c ON e.class_id = c.id
      `;
    } else {
      query = `
        SELECT e.id, s.full_name, c.class_name, e.enrollment_date, e.status
        FROM enrollments e
        JOIN students s ON e.student_id = s.id
        JOIN classes c ON e.class_id = c.id
        WHERE c.teacher_id = $1
      `;
      params = [user?.id];
    }
    const result = await pool.query(query, params);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Lỗi lấy danh sách ghi danh:", error);
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

// 2. Ghi danh học sinh vào lớp (POST)
export const enrollStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { class_id, student_id } = req.body;
    const user = req.user;

    if (user?.role === 'TEACHER') {
      const checkClass = await pool.query('SELECT id FROM classes WHERE id = $1 AND teacher_id = $2', [class_id, user.id]);
      if (checkClass.rows.length === 0) {
        res.status(403).json({ message: "Không có quyền thêm học sinh vào lớp này" });
        return;
      }
    }

    // 1. THÊM BỘ LỌC KIỂM TRA TRÙNG LẶP
    const checkExist = await pool.query(
      'SELECT * FROM enrollments WHERE class_id = $1 AND student_id = $2',
      [class_id, student_id]
    );

    if (checkExist.rows.length > 0) {
      res.status(400).json({ message: '❌ Học sinh này đã có trong lớp rồi!' });
      return;
    }

    const result = await pool.query(
      'INSERT INTO enrollments (class_id, student_id) VALUES ($1, $2) RETURNING *',
      [class_id, student_id]
    );

    res.status(201).json({ message: '✅ Đã thêm học sinh vào lớp!', data: result.rows[0] });
  } catch (error) {
    console.error("Lỗi khi thêm học sinh vào lớp:", error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// 3. Cập nhật trạng thái học tập (PUT)
export const updateEnrollmentStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // ID của lượt ghi danh
    const { status } = req.body;
    const user = req.user;

    if (user?.role === 'TEACHER') {
      const check = await pool.query(
        'SELECT c.id FROM enrollments e JOIN classes c ON e.class_id = c.id WHERE e.id = $1 AND c.teacher_id = $2',
        [id, user.id]
      );
      if (check.rows.length === 0) {
        res.status(403).json({ message: "Không có quyền sửa thông tin xếp lớp này" });
        return;
      }
    }
    
    const result = await pool.query(
      'UPDATE enrollments SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    
    if (result.rows.length === 0) {
      res.status(404).json({ message: "Không tìm thấy thông tin xếp lớp này" });
      return;
    }
    
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Lỗi khi cập nhật trạng thái:", error);
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

// 4. Hủy ghi danh (DELETE)
export const deleteEnrollment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (user?.role === 'TEACHER') {
      const check = await pool.query(
        'SELECT c.id FROM enrollments e JOIN classes c ON e.class_id = c.id WHERE e.id = $1 AND c.teacher_id = $2',
        [id, user.id]
      );
      if (check.rows.length === 0) {
        res.status(403).json({ message: "Không có quyền xóa xếp lớp này" });
        return;
      }
    }
    
    const result = await pool.query('DELETE FROM enrollments WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      res.status(404).json({ message: "Không tìm thấy thông tin xếp lớp này" });
      return;
    }
    
    res.status(200).json({ message: "Đã hủy xếp lớp thành công" });
  } catch (error) {
    console.error("Lỗi khi xóa ghi danh:", error);
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

// Lấy danh sách học sinh trong một lớp
export const getStudentsInClass = async (req: AuthRequest, res: Response): Promise<void> => {
  const { class_id } = req.params;
  const user = req.user;
  try {
    if (user?.role === 'TEACHER') {
      const check = await pool.query('SELECT id FROM classes WHERE id = $1 AND teacher_id = $2', [class_id, user.id]);
      if (check.rows.length === 0) {
        res.status(403).json({ message: "Không có quyền xem học sinh của lớp này" });
        return;
      }
    }

    const result = await pool.query(
      `SELECT s.id, s.full_name, s.phone_number, e.enrollment_date 
       FROM students s
       JOIN enrollments e ON s.id = e.student_id
       WHERE e.class_id = $1`,
      [class_id]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error });
  }
};

// Lấy danh sách lớp mà một học sinh đang học
export const getClassesForStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  const { student_id } = req.params;
  const user = req.user;
  try {
    let result;
    if (user?.role === 'TEACHER') {
      result = await pool.query(
        `SELECT c.id, c.class_name 
         FROM classes c
         JOIN enrollments e ON c.id = e.class_id
         WHERE e.student_id = $1 AND c.teacher_id = $2`,
        [student_id, user.id]
      );
    } else {
      result = await pool.query(
        `SELECT c.id, c.class_name 
         FROM classes c
         JOIN enrollments e ON c.id = e.class_id
         WHERE e.student_id = $1`,
        [student_id]
      );
    }
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error });
  }
};