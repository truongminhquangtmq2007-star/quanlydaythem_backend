const fs = require('fs');

let code = fs.readFileSync('src/index.ts', 'utf8');
if (!code.includes('folderRoutes')) {
  code = code.replace("import documentRoutes", "import folderRoutes from './routes/folderRoutes';\nimport documentRoutes");
  code = code.replace("app.use('/api/documents'", "app.use('/api/folders', folderRoutes);\napp.use('/api/documents'");
  fs.writeFileSync('src/index.ts', code);
}

const folderRoutesCode = `
import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware';
import { createFolder, updateFolder, deleteFolder, getFolderContents } from '../controllers/documentController';

const router = Router();

router.get('/:folderId/contents', verifyToken, getFolderContents);
router.post('/', verifyToken, createFolder);
router.put('/:id', verifyToken, updateFolder);
router.delete('/:id', verifyToken, deleteFolder);

export default router;
`;
fs.writeFileSync('src/routes/folderRoutes.ts', folderRoutesCode);

const docRoutesCode = `
import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware';
import { addDocument, updateDocument, deleteDocument, getAllDocuments } from '../controllers/documentController';

const router = Router();

router.get('/', verifyToken, getAllDocuments);
router.post('/', verifyToken, addDocument);
router.put('/:id', verifyToken, updateDocument);
router.delete('/:id', verifyToken, deleteDocument);

export default router;
`;
fs.writeFileSync('src/routes/documentRoutes.ts', docRoutesCode);
console.log('Routes setup complete');

