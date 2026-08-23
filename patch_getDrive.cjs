const fs = require('fs');

// 1. Add getDrive to documentController.ts
let docCtrl = fs.readFileSync('src/controllers/documentController.ts', 'utf8');

if (!docCtrl.includes('export const getDrive')) {
  const getDriveFn = `
export const getDrive = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { category, class_id } = req.query;
    // Just a placeholder to return folders and docs matching conditions
    let foldersQuery = 'SELECT * FROM folders WHERE 1=1';
    let docsQuery = 'SELECT * FROM documents WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;

    if (category) {
      foldersQuery += \` AND category = $\${paramIdx}\`;
      docsQuery += \` AND category = $\${paramIdx}\`;
      params.push(category);
      paramIdx++;
    }

    if (class_id) {
      foldersQuery += \` AND class_id = $\${paramIdx}\`;
      docsQuery += \` AND class_id = $\${paramIdx}\`;
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
`;
  docCtrl = docCtrl + getDriveFn;
  fs.writeFileSync('src/controllers/documentController.ts', docCtrl);
}

// 2. Add route to folderRoutes.ts
let folderRoutes = fs.readFileSync('src/routes/folderRoutes.ts', 'utf8');
if (!folderRoutes.includes('getDrive')) {
  folderRoutes = folderRoutes.replace(/import \{([^}]+)\} from '\.\.\/controllers\/documentController';/, "import { $1, getDrive } from '../controllers/documentController';");
  folderRoutes = folderRoutes.replace("router.get('/:folderId/contents'", "router.get('/drive', verifyToken, getDrive);\nrouter.get('/:folderId/contents'");
  fs.writeFileSync('src/routes/folderRoutes.ts', folderRoutes);
}

console.log('Patched getDrive in documentController and folderRoutes');

