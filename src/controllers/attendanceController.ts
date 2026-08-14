import { Request, Response } from 'express';
import pool from '../db';

// 1. Lấy lịch sử điểm danh (Kèm tên học sinh và tên lớp)
export const getAttendance = async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT a.id, s.full_name, c.class_name, a.attendance_date, a.status, a.notes
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      JOIN classes c ON a.class_id = c.id
      ORDER BY a.attendance_date DESC
    `;
    const result = await pool.query(query);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Lỗi lấy danh sách điểm danh:", error);
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

// 2. Điểm danh học sinh (POST)
export const markAttendance = async (req: Request, res: Response) => {
  try {
    const { student_id, class_id, status, notes } = req.body;
    
    // Nếu không truyền ngày, CSDL sẽ tự lấy ngày hôm nay
    const newAttendance = await pool.query(
      'INSERT INTO attendance (student_id, class_id, status, notes) VALUES ($1, $2, $3, $4) RETURNING *',
      [student_id, class_id, status || 'Có mặt', notes || '']
    );
    res.status(201).json(newAttendance.rows[0]);
  } catch (error) {
    console.error("Lỗi khi điểm danh:", error);
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};