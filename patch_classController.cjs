const fs = require('fs');
let code = fs.readFileSync('src/controllers/classController.ts', 'utf8');

const newGetClassMembers = `export const getClassMembers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      \`SELECT e.id, e.student_id, e.class_id, e.enrollment_date, e.status as enrollment_status, 
              s.full_name, s.username as student_code, s.phone_number as phone 
       FROM enrollments e 
       JOIN students s ON e.student_id = s.id 
       WHERE e.class_id = $1 ORDER BY s.full_name\`,
      [id]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Lỗi get class members:", error);
    res.status(500).json({ error: "Lỗi khi lấy danh sách học sinh" });
  }
};`;

code = code.replace(/export const getClassMembers = async \([\s\S]*?\}\s*catch[^{]*\{[^}]*\}\s*\};/m, newGetClassMembers);

fs.writeFileSync('src/controllers/classController.ts', code);
console.log('Patched getClassMembers in classController.ts');

