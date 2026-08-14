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
    
    // Nếu là Giám đốc (ADMIN) -> Lấy toàn bộ danh sách lớp
    if (user.role === 'ADMIN') {
      result = await pool.query('SELECT * FROM classes ORDER BY id DESC');
    } 
    // Nếu là Giáo viên -> Chỉ lấy những lớp khớp với ID của giáo viên đó
    else {
      result = await pool.query(
        'SELECT * FROM classes WHERE teacher_id = $1 ORDER BY id DESC', 
        [user.id]
      );
    }
    
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Lỗi khi lấy danh sách lớp học:", error);
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};
// 2. Thêm lớp học mới (POST)
export const createClass = async (req: AuthRequest, res: Response): Promise<void> => {
  // Bổ sung teacher_id
  const { class_name, description, teacher_id } = req.body; 
  try {
    const result = await pool.query(
      `INSERT INTO classes (class_name, description, teacher_id) VALUES ($1, $2, $3) RETURNING *`,
      [class_name, description, teacher_id || null] // Nếu không chọn ai thì để null
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server" });
  }
};

export const updateClass = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  // Bổ sung teacher_id
  const { class_name, description, teacher_id } = req.body; 
  try {
    await pool.query(
      `UPDATE classes SET class_name = $1, description = $2, teacher_id = $3 WHERE id = $4`,
      [class_name, description, teacher_id || null, id]
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
    const result = await pool.query('DELETE FROM classes WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ message: "Không tìm thấy lớp học" });
      return;
    }
    res.status(200).json({ message: "Đã xóa lớp học thành công" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};
// Hàm gán giáo viên cho lớp học
export const assignTeacher = async (req: Request, res: Response): Promise<void> => {
  try {
    const classId = req.params.id;
    const { teacher_id } = req.body; // Gửi teacher_id từ Frontend lên

    const result = await pool.query(
      'UPDATE classes SET teacher_id = $1 WHERE id = $2 RETURNING *',
      [teacher_id, classId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ message: 'Không tìm thấy lớp học' });
      return;
    }

    res.status(200).json({ 
      message: 'Đã phân công giáo viên thành công!', 
      class: result.rows[0] 
    });
  } catch (error) {
    console.error("Lỗi khi gán giáo viên:", error);
    res.status(500).json({ message: 'Lỗi máy chủ' });
  }
};