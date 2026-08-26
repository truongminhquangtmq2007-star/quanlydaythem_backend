const fs = require('fs');
let code = fs.readFileSync('src/controllers/studentController.ts', 'utf8');

const profile360Str = `
export const getProfile360 = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const studentRes = await pool.query('SELECT * FROM students WHERE id = $1', [id]);
    if (studentRes.rows.length === 0) {
      res.status(404).json({ message: 'Không tìm thấy học sinh' });
      return;
    }
    const student = studentRes.rows[0];

    // Lấy lớp học (sửa class_members thành enrollments)
    const classRes = await pool.query(
      'SELECT c.class_name, c.schedule, c.meet_link FROM enrollments e JOIN classes c ON e.class_id = c.id WHERE e.student_id = $1 AND e.status = \\'ACTIVE\\'',
      [id]
    );

    const attendRes = await pool.query(
      'SELECT status, count(*) FROM attendance WHERE student_id = $1 GROUP BY status',
      [id]
    );

    const scoresRes = await pool.query(
      'SELECT document_id, total_score, submitted_at FROM exam_submissions WHERE student_id = $1 ORDER BY submitted_at DESC LIMIT 5',
      [id]
    );

    res.status(200).json({
      student,
      classes: classRes.rows,
      attendance: attendRes.rows,
      recent_scores: scoresRes.rows,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server' });
  }
};
`;

code = code.replace("export const updateStudent", profile360Str + "\nexport const updateStudent");
fs.writeFileSync('src/controllers/studentController.ts', code);
console.log("Restored getProfile360");

