const fs = require('fs');
let code = fs.readFileSync('src/controllers/documentController.ts', 'utf8');

code = code.replace(
  /export const createFolder = async \(req: AuthRequest, res: Response\): Promise<void> => \{\s*try \{\s*const \{ name, parent_id \} = req\.body;\s*const result = await pool\.query\(\s*'INSERT INTO folders \(name, parent_id, created_at\) VALUES \(\$1, \$2, NOW\(\)\) RETURNING \*',\s*\[name, parent_id \|\| null\]\s*\);/,
  `export const createFolder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, parent_id, category } = req.body;
    if (!category || !['STORAGE', 'EXAM'].includes(category)) {
      res.status(400).json({ error: 'category bắt buộc là STORAGE hoặc EXAM' });
      return;
    }
    const result = await pool.query(
      'INSERT INTO folders (name, parent_id, category, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
      [name, parent_id || null, category]
    );`
);

fs.writeFileSync('src/controllers/documentController.ts', code);
console.log('Fixed createFolder API');

