import { Request, Response } from 'express';
import pool from '../db';
import bcrypt from 'bcrypt';

// Khai báo thêm giao diện (interface) để TypeScript hiểu rằng
// Request này có mang theo thông tin "user" (Thẻ từ đã được giải mã)
export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: string;
  };
}

// LẤY DANH SÁCH HỌC SINH (ĐÃ TÍCH HỢP BỘ LỌC PHÂN QUYỀN)
export const getStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ message: "Không tìm thấy thông tin xác thực!" });
      return;
    }

    let result;
    // Nếu là Giám đốc (ADMIN) -> Nhìn thấy toàn bộ
    if (user.role === 'ADMIN') {
      result = await pool.query('SELECT * FROM students ORDER BY created_at DESC');
    } 
    // Nếu là Giáo viên -> Chỉ lấy học sinh của mình
    else {
      result = await pool.query(
        'SELECT * FROM students WHERE teacher_id = $1 ORDER BY created_at DESC', 
        [user.id]
      );
    }
    
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Lỗi khi lấy danh sách học sinh:", error);
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

// THÊM HỌC SINH MỚI (GẮN CHẶT VỚI ID CỦA GIÁO VIÊN TẠO RA)
export const createStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  const { full_name, phone_number } = req.body;
  const user = req.user;

  if (!user) {
    res.status(401).json({ message: "Không tìm thấy thông tin xác thực!" });
    return;
  }

  try {
    const username = phone_number; 
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash('123456', saltRounds);

    // Lưu vào Database (Bơm thêm teacher_id chính là ID của người đang đăng nhập)
    const result = await pool.query(
      `INSERT INTO students (full_name, phone_number, username, password, teacher_id) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id, full_name, username`,
      [full_name, phone_number, username, hashedPassword, user.id]
    );

    res.status(201).json({
      message: 'Thêm học sinh và cấp tài khoản thành công',
      student: result.rows[0]
    });
  } catch (error: any) {
    console.error("Lỗi khi thêm học sinh:", error);
    if (error.code === '23505') {
      res.status(400).json({ message: 'Số điện thoại này đã được sử dụng!' });
      return;
    }
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// SỬA THÔNG TIN HỌC SINH
export const updateStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params; 
    const { full_name, date_of_birth, phone_number, school_name, notes } = req.body; 
    const user = req.user;

    let result;
    if (user?.role === 'ADMIN') {
      // Admin sửa được tất cả
      result = await pool.query(
        'UPDATE students SET full_name = $1, date_of_birth = $2, phone_number = $3, school_name = $4, notes = $5 WHERE id = $6 RETURNING *',
        [full_name, date_of_birth, phone_number, school_name, notes, id]
      );
    } else {
      // Giáo viên chỉ sửa được học sinh của mình (Thêm điều kiện teacher_id = user.id)
      result = await pool.query(
        'UPDATE students SET full_name = $1, date_of_birth = $2, phone_number = $3, school_name = $4, notes = $5 WHERE id = $6 AND teacher_id = $7 RETURNING *',
        [full_name, date_of_birth, phone_number, school_name, notes, id, user?.id]
      );
    }
    
    if (result.rows.length === 0) {
      res.status(404).json({ message: "Không tìm thấy học sinh hoặc bạn không có quyền sửa" });
      return;
    }
    
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Lỗi khi cập nhật học sinh:", error);
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

// XÓA HỌC SINH
export const deleteStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user;
    
    let result;
    if (user?.role === 'ADMIN') {
      result = await pool.query('DELETE FROM students WHERE id = $1 RETURNING *', [id]);
    } else {
      result = await pool.query('DELETE FROM students WHERE id = $1 AND teacher_id = $2 RETURNING *', [id, user?.id]);
    }
    
    if (result.rows.length === 0) {
      res.status(404).json({ message: "Không tìm thấy học sinh hoặc bạn không có quyền xóa" });
      return;
    }
    
    res.status(200).json({ message: "Đã xóa học sinh thành công" });
  } catch (error) {
    console.error("Lỗi khi xóa học sinh:", error);
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};
