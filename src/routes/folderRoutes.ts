
import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware';
import {  createFolder, updateFolder, deleteFolder, getFolderContents , getDrive } from '../controllers/documentController';

const router = Router();

router.get('/drive', verifyToken, getDrive);
router.get('/:folderId/contents', verifyToken, getFolderContents);
router.post('/', verifyToken, createFolder);
router.put('/:id', verifyToken, updateFolder);
router.delete('/:id', verifyToken, deleteFolder);

export default router;
