import { Request, Response } from 'express';
import pool from '../db';

// 1. Xem danh sách đã xếp lớp (GET) - Dùng JOIN để lấy tên thật thay vì chỉ lấy ID
export const getEnrollments = async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT e.id, s.full_name, c.class_name, e.enrollment_date, e.status
      FROM enrollments e
      JOIN students s ON e.student_id = s.id
      JOIN classes c ON e.class_id = c.id
    `;
    const result = await pool.query(query);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Lỗi lấy danh sách ghi danh:", error);
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

// 2. Ghi danh học sinh vào lớp (POST)
export const enrollStudent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { class_id, student_id } = req.body;

    // 1. THÊM BỘ LỌC KIỂM TRA TRÙNG LẶP
    const checkExist = await pool.query(
      'SELECT * FROM enrollments WHERE class_id = $1 AND student_id = $2',
      [class_id, student_id]
    );

    // Nếu câu truy vấn trả về dữ liệu (> 0), nghĩa là học sinh đã ở trong lớp
    if (checkExist.rows.length > 0) {
      res.status(400).json({ message: '❌ Học sinh này đã có trong lớp rồi!' });
      return; // Ngắt mạch, không chạy đoạn code thêm mới phía dưới nữa
    }

    // 2. Lệnh INSERT cũ của bạn giữ nguyên
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
export const updateEnrollmentStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // ID của lượt ghi danh, không phải ID học sinh
    const { status } = req.body; // Ví dụ: "Bảo lưu", "Đã nghỉ", "Học online"
    
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
export const deleteEnrollment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
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
// Lấy danh sách các lớp mà một học sinh đang học
// Bổ sung hàm 1: Lấy danh sách học sinh trong một lớp (Dùng cho trang Chi tiết lớp)
export const getStudentsInClass = async (req: Request, res: Response): Promise<void> => {
  const { class_id } = req.params;
  try {
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

// Bổ sung hàm 2: Lấy danh sách lớp mà một học sinh đang học (Dùng cho Dropdown mục Học phí)
export const getClassesForStudent = async (req: Request, res: Response): Promise<void> => {
  const { student_id } = req.params;
  try {
    const result = await pool.query(
      `SELECT c.id, c.class_name 
       FROM classes c
       JOIN enrollments e ON c.id = e.class_id
       WHERE e.student_id = $1`,
      [student_id]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error });
  }
};