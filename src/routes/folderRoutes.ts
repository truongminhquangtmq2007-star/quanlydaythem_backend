
import { Router } from 'express';
import { verifyToken, isTeacherOrAdmin } from '../middleware/authMiddleware';
import {  createFolder, updateFolder, deleteFolder, getFolderContents , getDrive } from '../controllers/documentController';

const router = Router();

router.get('/drive', verifyToken, isTeacherOrAdmin, getDrive);
router.get('/:folderId/contents', verifyToken, isTeacherOrAdmin, getFolderContents);
router.post('/', verifyToken, isTeacherOrAdmin, createFolder);
router.put('/:id', verifyToken, isTeacherOrAdmin, updateFolder);
router.delete('/:id', verifyToken, isTeacherOrAdmin, deleteFolder);

export default router;
