const fs = require('fs');
let code = fs.readFileSync('src/controllers/classController.ts', 'utf8');

let start = code.indexOf('export const getClassMembers');
let end = code.indexOf('export const getClassSessions');
if (start !== -1 && end !== -1) {
  let newFunc = `export const getClassMembers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT s.id, s.full_name, s.phone_number AS phone FROM students s JOIN enrollments cm ON s.id = cm.student_id WHERE cm.class_id = $1 ORDER BY s.full_name',
      [id]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Lỗi get class members:", error);
    res.status(500).json({ error: "Lỗi khi lấy danh sách học sinh" });
  }
};

`;
  code = code.substring(0, start) + newFunc + code.substring(end);
  fs.writeFileSync('src/controllers/classController.ts', code);
  console.log('Fixed classController');
}

