import { Request, Response } from 'express';
import pool from '../db'; 

// ==========================================
// API 1: TẢI TÀI LIỆU/ẢNH LÊN
// ==========================================
export const uploadDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, category, folder_id, description, type, grade, subject } = req.body;
    let document_code = req.body.document_code;
    
    // Hỗ trợ cả file thực tế qua Multer hoặc truyền dạng chuỗi URL
    const file_url = req.file?.path || req.body.file_url;

    if (!file_url) {
      res.status(400).json({ message: 'Không tìm thấy file hoặc URL tải lên.' });
      return;
    }

    if (!document_code) {
      document_code = 'DOC' + Date.now().toString().slice(-6);
    }

    const parentFolderId = folder_id ? parseInt(folder_id) : null;

    // Lưu link ảnh/tài liệu vào Database (Bảng documents) - hỗ trợ cả 2 schema
    const newDoc = await pool.query(
      `INSERT INTO documents (document_code, title, file_url, category, folder_id, description, type, grade, subject) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
      [document_code, title, file_url, category || 'STORAGE', parentFolderId, description, type || 'REFERENCE', grade, subject]
    );

    res.status(201).json({
      message: 'Tải tài liệu lên thành công!',
      document: newDoc.rows[0] 
    });
  } catch (error: any) {
    // Fallback nếu initPhase2 chưa chạy (thiếu cột)
    try {
      const file_url = req.file?.path || req.body.file_url;
      const { title, category, folder_id } = req.body;
      const parentFolderId = folder_id ? parseInt(folder_id) : null;
      const fallback = await pool.query(
        `INSERT INTO documents (title, file_url, category, folder_id, uploaded_at) 
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) 
         RETURNING *`,
        [title, file_url, category || 'STORAGE', parentFolderId]
      );
      res.status(201).json({
        message: 'Tải tài liệu lên thành công (schema cũ)!',
        document: fallback.rows[0] 
      });
    } catch(e) {
      console.error(error, e);
      res.status(500).json({ message: 'Lỗi server khi tải tài liệu lên.' });
    }
  }
};

// ==========================================
// API 2: XÓA TÀI LIỆU
// ==========================================
export const deleteDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const deleteOp = await pool.query(
      'DELETE FROM documents WHERE id = $1 RETURNING *', 
      [id]
    );
    if (deleteOp.rowCount === 0) {
      res.status(404).json({ message: 'Không tìm thấy tài liệu để xóa.' });
      return;
    }
    res.status(200).json({ message: 'Đã xóa tài liệu thành công.' });
  } catch (error) {
    console.error("Lỗi khi xóa tài liệu:", error);
    res.status(500).json({ message: 'Lỗi server khi xóa tài liệu.' });
  }
};

// ==========================================
// API 3: LẤY DANH SÁCH TÀI LIỆU
// ==========================================
export const getAllDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, type, grade } = req.query;
    let query = 'SELECT * FROM documents WHERE 1=1';
    const values: any[] = [];
    let count = 1;

    if (search) {
      query += ` AND title ILIKE $${count}`;
      values.push(`%${search}%`);
      count++;
    }

    if (type && type !== 'ALL') {
      query += ` AND type = $${count}`;
      values.push(type);
      count++;
    }

    if (grade && grade !== 'ALL') {
      query += ` AND grade = $${count}`;
      values.push(grade);
      count++;
    }

    // support both schema dates (created_at or uploaded_at)
    // Coalesce is not easy since created_at might not exist yet, just use standard
    query += ' ORDER BY id DESC';

    const result = await pool.query(query, values);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Lỗi lấy danh sách tài liệu:", error);
    res.status(500).json({ message: 'Lỗi server.' });
  }
};