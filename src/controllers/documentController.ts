
import { Request, Response } from 'express';
import pool from '../db';
import { AuthRequest } from '../middleware/authMiddleware';

// ---------------------------------------------------------
// FOLDERS API
// ---------------------------------------------------------

export const createFolder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, parent_id, category } = req.body;
    if (!category || !['STORAGE', 'EXAM'].includes(category)) {
      res.status(400).json({ error: 'category bắt buộc là STORAGE hoặc EXAM' });
      return;
    }
    const result = await pool.query(
      'INSERT INTO folders (name, parent_id, category, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
      [name, parent_id || null, category]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Lỗi createFolder:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
};

export const updateFolder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const result = await pool.query(
      'UPDATE folders SET name = $1 WHERE id = $2 RETURNING *',
      [name, id]
    );
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Lỗi updateFolder:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
};

export const deleteFolder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM folders WHERE id = $1', [id]);
    res.status(200).json({ message: 'Đã xóa thư mục' });
  } catch (error) {
    console.error('Lỗi deleteFolder:', error);
    res.status(500).json({ error: 'Lỗi server (Có thể thư mục không trống)' });
  }
};

// ---------------------------------------------------------
// DOCUMENTS API
// ---------------------------------------------------------

export const getFolderContents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { folderId } = req.params;
    
    // root is "0" or "root" or null. Let's handle '0' or 'null'
    let parentCond = "parent_id IS NULL";
    let folderCond = "folder_id IS NULL";
    let params: any[] = [];
    
    if (folderId && folderId !== '0' && folderId !== 'null' && folderId !== 'root') {
      parentCond = "parent_id = $1";
      folderCond = "folder_id = $1";
      params = [folderId];
    }
    
    const foldersRes = await pool.query(`SELECT * FROM folders WHERE ${parentCond} ORDER BY name`, params);
    const docsRes = await pool.query(`SELECT * FROM documents WHERE ${folderCond} ORDER BY title`, params);
    
    res.status(200).json({
      folders: foldersRes.rows,
      documents: docsRes.rows
    });
  } catch (error) {
    console.error('Lỗi getFolderContents:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
};

export const addDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, file_url, folder_id } = req.body;
    const result = await pool.query(
      'INSERT INTO documents (title, file_url, folder_id, uploaded_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
      [title, file_url, folder_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Lỗi addDocument:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
};

export const updateDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, folder_id } = req.body;
    
    const result = await pool.query(
      'UPDATE documents SET title = $1, folder_id = $2 WHERE id = $3 RETURNING *',
      [title, folder_id || null, id]
    );
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Lỗi updateDocument:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
};

export const deleteDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM documents WHERE id = $1', [id]);
    res.status(200).json({ message: 'Đã xóa tài liệu' });
  } catch (error) {
    console.error('Lỗi deleteDocument:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
};

export const getAllDocuments = async (req: Request, res: Response): Promise<void> => {
  // Original method fallback just in case
  try {
    const result = await pool.query('SELECT * FROM documents ORDER BY uploaded_at DESC');
    res.json(result.rows);
  } catch(e) {
    res.status(500).json({ message: 'Lỗi' });
  }
};

export const uploadDocument = async (req: Request, res: Response): Promise<void> => {
  // Legacy method fallback
  res.status(200).json({ message: 'Legacy upload method' });
};

export const getDrive = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { category, class_id } = req.query;
    // Just a placeholder to return folders and docs matching conditions
    let foldersQuery = 'SELECT * FROM folders WHERE 1=1';
    let docsQuery = 'SELECT * FROM documents WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;

    if (category) {
      foldersQuery += ` AND category = $${paramIdx}`;
      docsQuery += ` AND category = $${paramIdx}`;
      params.push(category);
      paramIdx++;
    }

    if (class_id) {
      foldersQuery += ` AND class_id = $${paramIdx}`;
      docsQuery += ` AND class_id = $${paramIdx}`;
      params.push(class_id);
      paramIdx++;
    }

    const foldersRes = await pool.query(foldersQuery, params);
    const docsRes = await pool.query(docsQuery, params);

    res.status(200).json({
      folders: foldersRes.rows,
      documents: docsRes.rows
    });
  } catch (error) {
    console.error('Lỗi getDrive:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
};
