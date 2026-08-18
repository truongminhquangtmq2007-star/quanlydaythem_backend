import { Request, Response } from 'express';
import pool from '../db'; // Đảm bảo đường dẫn đến file db.ts là chính xác

// ==========================================
// API 1: TẢI TÀI LIỆU/ẢNH LÊN
// ==========================================
export const uploadDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, category, folder_id } = req.body;
    
    // Khi dùng thư viện Multer + Cloudinary, link file sẽ tự động nằm ở req.file.path
    const file_url = req.file?.path;

    if (!file_url) {
      res.status(400).json({ message: 'Không tìm thấy file tải lên.' });
      return;
    }

    // Xử lý folder_id: Nếu không có (thư mục gốc) thì set là null
    const parentFolderId = folder_id ? parseInt(folder_id) : null;

    // Lưu link ảnh/tài liệu vào Database (Bảng documents)
    const newDoc = await pool.query(
      `INSERT INTO documents (title, file_url, category, folder_id, uploaded_at) 
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) 
       RETURNING *`,
      [title, file_url, category || 'STORAGE', parentFolderId]
    );

    // Dữ liệu JSON trả về cho Frontend
    res.status(201).json({
      message: 'Tải tài liệu lên thành công!',
      document: newDoc.rows[0] 
    });
  } catch (error) {
    console.error("Lỗi khi tải tài liệu:", error);
    res.status(500).json({ message: 'Lỗi server khi tải tài liệu lên.' });
  }
};

// ==========================================
// API 2: XÓA TÀI LIỆU
// ==========================================
export const deleteDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Xóa record trong database
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
    const allDocs = await pool.query('SELECT * FROM documents ORDER BY uploaded_at DESC');
    res.status(200).json(allDocs.rows);
  } catch (error) {
    console.error("Lỗi lấy danh sách tài liệu:", error);
    res.status(500).json({ message: 'Lỗi server.' });
  }
};