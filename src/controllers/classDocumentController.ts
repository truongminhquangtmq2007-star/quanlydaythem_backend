import { Request, Response } from 'express';
import pool from '../db';
import { AuthRequest } from '../middleware/authMiddleware';

export const getAssignableDocuments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // class_id
    
    // Get documents that belong to folders with NO class_id or class_id = this class
    // Also include documents with NO folder_id (if any)
    const query = `
      SELECT d.id, d.title, d.category, d.folder_id, d.file_url, d.uploaded_at AS created_at, f.name AS folder_name, f.class_id AS folder_class_id
      FROM documents d
      LEFT JOIN folders f ON d.folder_id = f.id
      WHERE f.class_id IS NULL OR f.class_id = $1 OR d.folder_id IS NULL
      ORDER BY f.name NULLS FIRST, d.title
    `;
    const result = await pool.query(query, [id]);
    
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Lỗi getAssignableDocuments:", error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

export const assignDocumentsToClass = async (req: AuthRequest, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { document_ids } = req.body;
    
    if (!Array.isArray(document_ids) || document_ids.length === 0) {
      res.status(400).json({ message: 'Danh sách tài liệu không hợp lệ' });
      return;
    }

    await client.query('BEGIN');

    for (const docId of document_ids) {
      // Get document category
      const docRes = await client.query('SELECT category, folder_id FROM documents WHERE id = $1', [docId]);
      if (docRes.rows.length === 0) continue;
      
      const category = docRes.rows[0].category || 'STORAGE';
      
      // Find or create folder in this class with this category
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
          'INSERT INTO folders (name, category, class_id) VALUES ($1, $2, $3) RETURNING id',
          [folderName, category, id]
        );
        folderId = newFolder.rows[0].id;
      }
      
      // Update document
      await client.query('UPDATE documents SET folder_id = $1 WHERE id = $2', [folderId, docId]);
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

