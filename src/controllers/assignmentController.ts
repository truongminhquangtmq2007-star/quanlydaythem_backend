import { Request, Response } from 'express';
import pool from '../db';
import { AuthRequest } from '../middleware/authMiddleware';

// POST /api/assignments
export const createAssignment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, class_id, document_id, due_at } = req.body;
    const user = req.user;
    if (user?.role === 'TEACHER') {
      const check = await pool.query('SELECT id FROM classes WHERE id = $1 AND teacher_id = $2', [class_id, user.id]);
      if (check.rows.length === 0) {
        res.status(403).json({ message: "Không có quyền giao bài cho lớp này" });
        return;
      }
    }

    const result = await pool.query(
      `INSERT INTO assignments (title, class_id, document_id, due_at) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [title, class_id, document_id, due_at]
    );

    res.status(201).json({
      message: 'Giao bài tập thành công',
      assignment: result.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server khi giao bài tập' });
  }
};

// GET /api/classes/:id/assignments
export const getClassAssignments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user;
    if (user?.role === 'TEACHER') {
      const check = await pool.query('SELECT id FROM classes WHERE id = $1 AND teacher_id = $2', [id, user.id]);
      if (check.rows.length === 0) {
        res.status(403).json({ message: "Không có quyền xem bài tập của lớp này" });
        return;
      }
    }

    const result = await pool.query(
      `SELECT a.*, d.category, f.name as folder_name 
       FROM assignments a
       LEFT JOIN documents d ON a.document_id = d.id
       LEFT JOIN folders f ON d.folder_id = f.id
       WHERE a.class_id = $1
       ORDER BY a.created_at DESC`,
      [id]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({ message: "Lỗi server khi tải danh sách bài tập" });
  }
};

