import { Router } from 'express';
import { createFolder, getDriveContents, renameFolder } from '../controllers/folderController';
import { verifyToken, isAdmin } from '../middleware/authMiddleware'; 
import pool from '../db';

const router = Router();

// Lấy nội dung thư mục (Giáo viên và Admin đều được xem)
router.get('/drive', verifyToken, getDriveContents);

// Tạo và đổi tên thư mục (Chỉ Admin mới có quyền thao tác trong kho chung)
router.post('/', verifyToken, createFolder);
router.put('/:id', verifyToken, renameFolder);
// Cổng xóa thư mục
router.delete('/:id', verifyToken, async (req, res): Promise<void> => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM folders WHERE id = $1', [id]);
    
    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Không tìm thấy thư mục để xóa' });
      return;
    }

    res.status(200).json({ message: 'Xóa thư mục thành công' });
  } catch (error) {
    console.error("Lỗi khi xóa thư mục:", error);
    res.status(500).json({ message: 'Lỗi server khi xóa thư mục' });
  }
});

export default router;