const fs = require('fs');
let code = fs.readFileSync('src/controllers/classController.ts', 'utf8');

const updateClassOld = `export const updateClass = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { class_name, description, teacher_id, class_type, meet_link } = req.body; 
  try {
    await pool.query(
      \`UPDATE classes SET class_name = $1, description = $2, teacher_id = $3, class_type = $4, meet_link = $5 WHERE id = $6\`,
      [class_name, description, teacher_id || null, class_type || 'OFFLINE', meet_link || null, id]
    );
    res.status(200).json({ message: "Cập nhật thành công" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server" });
  }
};`;

const updateClassNew = `export const updateClass = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { class_name, description, teacher_id, class_type, meet_link } = req.body; 
  try {
    const user = req.user;
    if (user?.role === 'TEACHER') {
        const check = await pool.query('SELECT id FROM classes WHERE id = $1 AND teacher_id = $2', [id, user.id]);
        if (check.rows.length === 0) {
            res.status(403).json({ message: "Bạn không có quyền sửa lớp này" });
            return;
        }
    }
    await pool.query(
      \`UPDATE classes SET class_name = $1, description = $2, teacher_id = $3, class_type = $4, meet_link = $5 WHERE id = $6\`,
      [class_name, description, teacher_id || null, class_type || 'OFFLINE', meet_link || null, id]
    );
    res.status(200).json({ message: "Cập nhật thành công" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server" });
  }
};`;

const deleteClassOld = `export const deleteClass = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    try { await pool.query('ALTER TABLE classes ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE'); } catch(e){}
    try { await pool.query('UPDATE classes SET is_active = TRUE WHERE is_active IS NULL'); } catch(e){}

    const result = await pool.query('UPDATE classes SET is_active = FALSE WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ message: "Không tìm thấy lớp học" });
      return;
    }
    res.status(200).json({ message: "Đã xóa (ẩn) lớp học thành công" });
  } catch (error: any) {
    console.error('Lỗi xóa lớp:', error);
    res.status(500).json({ message: "Lỗi máy chủ nội bộ", details: error.message });
  }
};`;

const deleteClassNew = `export const deleteClass = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user;
    if (user?.role === 'TEACHER') {
        const check = await pool.query('SELECT id FROM classes WHERE id = $1 AND teacher_id = $2', [id, user.id]);
        if (check.rows.length === 0) {
            res.status(403).json({ message: "Bạn không có quyền xóa lớp này" });
            return;
        }
    }
    
    try { await pool.query('ALTER TABLE classes ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE'); } catch(e){}
    try { await pool.query('UPDATE classes SET is_active = TRUE WHERE is_active IS NULL'); } catch(e){}

    const result = await pool.query('UPDATE classes SET is_active = FALSE WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ message: "Không tìm thấy lớp học" });
      return;
    }
    res.status(200).json({ message: "Đã xóa (ẩn) lớp học thành công" });
  } catch (error: any) {
    console.error('Lỗi xóa lớp:', error);
    res.status(500).json({ message: "Lỗi máy chủ nội bộ", details: error.message });
  }
};`;

// Note: might have whitespace issues doing simple string replacement, let's use regex for safety

// For updateClass
code = code.replace(/export const updateClass =[\s\S]*?catch \(error\) {\s*res\.status\(500\)\.json\({ message: "Lỗi server" }\);\s*}\s*};/, updateClassNew);
// For deleteClass
code = code.replace(/export const deleteClass =[\s\S]*?catch \(error: any\) {[\s\S]*?res\.status\(500\)[\s\S]*?}\s*};/, deleteClassNew);

fs.writeFileSync('src/controllers/classController.ts', code);
console.log('Fixed classController.ts IDORs!');

