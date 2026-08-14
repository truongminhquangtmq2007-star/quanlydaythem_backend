import { Router, Response } from 'express';
import { upload } from '../middleware/uploadMiddleware';
import { verifyToken, AuthRequest } from '../middleware/authMiddleware'; // Import "Máy quét thẻ"
import pool from '../db'; 

const router = Router();

// Gắn verifyToken vào ngay sau đường dẫn để chặn người lạ
router.post('/upload', verifyToken, upload.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user; // Dữ liệu thẻ từ sau khi quét thành công
    
    if (!req.file) {
      res.status(400).json({ message: 'Không tìm thấy file để tải lên' });
      return;
    }

    // Đã bổ sung nhận thêm folder_id từ Frontend gửi lên
    const { title, category, folder_id } = req.body; 
    const fileUrl = req.file.path;

    // Chuyển đổi folder_id thành số, nếu tải ở ngoài cùng thì là null
    const parsedFolderId = folder_id ? parseInt(folder_id, 10) : null;

    // Đã cắm thêm chân folder_id vào Database
    const result = await pool.query(
      `INSERT INTO documents (title, file_url, category, teacher_id, folder_id) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [title, fileUrl, category, user?.id, parsedFolderId]
    );
    
    res.status(201).json({
      message: 'Tải tài liệu và lưu trữ thành công!',
      document: result.rows[0]
    });
  } catch (error) {
    console.error("Lỗi upload file:", error);
    res.status(500).json({ message: 'Lỗi server khi xử lý file' });
  }
});

// Cổng Xóa tài liệu
router.delete('/:id', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM documents WHERE id = $1', [id]);
    
    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Không tìm thấy tài liệu để xóa' });
      return;
    }

    res.status(200).json({ message: 'Xóa tài liệu thành công' });
  } catch (error) {
    console.error("Lỗi khi xóa tài liệu:", error);
    res.status(500).json({ message: 'Lỗi server khi xóa tài liệu' });
  }
});

export default router;