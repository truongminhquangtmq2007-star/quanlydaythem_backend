import { Request, Response } from 'express';
import pool from '../db';
import { AuthRequest } from '../middleware/authMiddleware';

// POST /api/assignments
export const createAssignment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, class_id, document_id, due_at } = req.body;
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
export const getClassAssignments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // class_id
    const result = await pool.query(
      `SELECT a.*, d.title as document_title, d.file_url, d.type as document_type 
       FROM assignments a 
       LEFT JOIN documents d ON a.document_id = d.id 
       WHERE a.class_id = $1 
       ORDER BY a.created_at DESC`,
      [id]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi máy chủ nội bộ khi lấy bài tập" });
  }
};

