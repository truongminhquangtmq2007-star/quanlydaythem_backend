const fs = require('fs');
let code = fs.readFileSync('src/controllers/classController.ts', 'utf8');

code = code.replace(
  /export const getSessionAttendance = async \(req: Request, res: Response\): Promise<void> => \{[\s\S]*?\};/,
  `export const getSessionAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // session_id
    // 1. Get session info
    const sessionRes = await pool.query('SELECT class_id, session_date FROM sessions WHERE id = $1', [id]);
    if (sessionRes.rows.length === 0) {
      res.status(404).json({ message: "Không tìm thấy buổi học" });
      return;
    }
    const { class_id, session_date } = sessionRes.rows[0];

    // 2. Query attendance
    const result = await pool.query(
      \`SELECT a.*, s.full_name, s.id as student_code
       FROM attendance a 
       JOIN students s ON a.student_id = s.id 
       WHERE a.class_id = $1 AND a.attendance_date = $2 ORDER BY s.full_name\`,
      [class_id, session_date]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
};`
);

// We should also fix updateAttendance in case it uses session_id
// Let's check updateAttendance first
fs.writeFileSync('src/controllers/classController.ts', code);
console.log('Fixed getSessionAttendance');
