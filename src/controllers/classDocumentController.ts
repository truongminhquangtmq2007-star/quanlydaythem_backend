import { Request, Response } from 'express';
import pool from '../db';
import { AuthRequest } from '../middleware/authMiddleware';

export const getAssignableDocuments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // class_id
    const user = req.user;
    
    if (user?.role === 'TEACHER') {
      const checkClass = await pool.query('SELECT id FROM classes WHERE id = $1 AND teacher_id = $2', [id, user.id]);
      if (checkClass.rows.length === 0) {
        res.status(403).json({ message: 'Bạn không có quyền quản lý lớp này' });
        return;
      }
    }

    const teacherId = user?.role === 'TEACHER' ? user.id : null;

    const query = `
      SELECT d.id, d.title, d.category, d.folder_id, d.file_url, d.uploaded_at AS created_at, f.name AS folder_name, f.class_id AS folder_class_id
      FROM documents d
      LEFT JOIN folders f ON d.folder_id = f.id
      WHERE ($2::int IS NULL OR d.teacher_id = $2)
      ORDER BY f.name NULLS FIRST, d.title
    `;
    const result = await pool.query(query, [id, teacherId]);
    
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Lỗi getAssignableDocuments:", error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

export const assignDocumentsToClass = async (req: AuthRequest, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    const { id } = req.params; // class_id
    const { document_ids, due_at, session_id, session_date, title } = req.body;
    const user = req.user;

    if (user?.role === 'TEACHER') {
      const checkClass = await pool.query('SELECT id FROM classes WHERE id = $1 AND teacher_id = $2', [id, user.id]);
      if (checkClass.rows.length === 0) {
        res.status(403).json({ message: 'Bạn không có quyền quản lý lớp này' });
        return;
      }
    }
    
    if (!Array.isArray(document_ids) || document_ids.length === 0) {
      res.status(400).json({ message: 'Danh sách tài liệu không hợp lệ' });
      return;
    }

    await client.query('BEGIN');

    const sessionDesc = session_id 
      ? `Buổi học: ${session_date || `Session #${session_id}`}` 
      : 'Tài liệu chung';

    for (const docId of document_ids) {
      // Get document category and title
      const docRes = await client.query('SELECT id, title, category, folder_id, teacher_id FROM documents WHERE id = $1', [docId]);
      if (docRes.rows.length === 0) continue;
      
      const doc = docRes.rows[0];
      if (user?.role === 'TEACHER' && doc.teacher_id && doc.teacher_id !== user.id) {
        continue; // Skip documents not owned by this teacher
      }

      const category = doc.category || 'STORAGE';
      const assignTitle = title || doc.title || 'Tài liệu / Bài tập';

      // Insert into assignments table
      await client.query(
        `INSERT INTO assignments (class_id, document_id, title, due_at, description, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [id, docId, assignTitle, due_at || null, sessionDesc]
      );
      
      // Also ensure folder structure is in place
      let folderId = null;
      const folderRes = await client.query(
        'SELECT id FROM folders WHERE class_id = $1 AND category = $2 LIMIT 1',
        [id, category]
      );
      
      if (folderRes.rows.length > 0) {
        folderId = folderRes.rows[0].id;
      } else {
        const folderName = category === 'EXAM' ? 'Đề thi' : 'Tài liệu';
        const newFolder = await client.query(
          'INSERT INTO folders (name, category, class_id, teacher_id, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id',
          [folderName, category, id, user?.id || null]
        );
        folderId = newFolder.rows[0].id;
      }
    }

    await client.query('COMMIT');
    res.status(200).json({ message: 'Gán tài liệu vào lớp thành công.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Lỗi assignDocumentsToClass:", error);
    res.status(500).json({ message: 'Lỗi server' });
  } finally {
    client.release();
  }
};

