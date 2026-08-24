const fs = require('fs');
let code = fs.readFileSync('src/controllers/classController.ts', 'utf8');

code = code.replace(
  /export const updateAttendance = async \(req: Request, res: Response\): Promise<void> => \{[\s\S]*?\};/,
  `export const updateAttendance = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params; // session_id
  const { student_id, status, note } = req.body;
  try {
    // 1. Lấy thông tin session
    const sessionRes = await pool.query('SELECT class_id, session_date FROM sessions WHERE id = $1', [id]);
    if (sessionRes.rows.length === 0) {
      res.status(404).json({ message: "Không tìm thấy buổi học" });
      return;
    }
    const { class_id, session_date } = sessionRes.rows[0];

    // 2. Upsert điểm danh do không có session_id
    const checkRes = await pool.query(
      'SELECT id FROM attendance WHERE class_id = $1 AND attendance_date = $2 AND student_id = $3',
      [class_id, session_date, student_id]
    );

    let result;
    if (checkRes.rows.length > 0) {
      result = await pool.query(
        \`UPDATE attendance SET status = $1, notes = $2 
         WHERE class_id = $3 AND attendance_date = $4 AND student_id = $5 RETURNING *\`,
        [status, note, class_id, session_date, student_id]
      );
    } else {
      result = await pool.query(
        \`INSERT INTO attendance (class_id, attendance_date, student_id, status, notes) 
         VALUES ($1, $2, $3, $4, $5) RETURNING *\`,
        [class_id, session_date, student_id, status, note]
      );
    }

    res.status(200).json({ message: "Cập nhật điểm danh thành công", attendance: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server khi cập nhật điểm danh" });
  }
};`
);

fs.writeFileSync('src/controllers/classController.ts', code);
console.log('Fixed updateAttendance');
