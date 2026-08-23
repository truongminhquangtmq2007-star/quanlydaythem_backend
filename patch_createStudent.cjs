const fs = require('fs');

let code = fs.readFileSync('src/controllers/studentController.ts', 'utf8');

const newCreateStudent = `export const createStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  console.error("Payload from Frontend:", req.body);
  const { full_name, phone_number, phone, school_name, school, date_of_birth, notes } = req.body;
  const user = req.user;

  const phoneToUse = phone_number || phone || '';
  const schoolToUse = school_name || school || '';
  const dobToUse = date_of_birth || null;
  const notesToUse = notes || '';

  try {
    const result = await pool.query(
      \`INSERT INTO students (full_name, phone_number, school_name, date_of_birth, notes, created_at) 
       VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *\`,
      [full_name || 'Khách', phoneToUse, schoolToUse, dobToUse, notesToUse]
    );

    const student = result.rows[0];
    res.status(201).json(student);
  } catch (error: any) {
    console.error("Lỗi tạo học sinh:", error);
    res.status(400).json({ message: "Không thể tạo học sinh", error: error.message });
  }
};`;

code = code.replace(/export const createStudent = async \([\s\S]*?\}\s*catch[^}]*\}\s*\};/, newCreateStudent);

fs.writeFileSync('src/controllers/studentController.ts', code);
console.log('Patched createStudent');

