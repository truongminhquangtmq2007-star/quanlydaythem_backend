const fs = require('fs');
let code = fs.readFileSync('src/controllers/studentController.ts', 'utf8');

const splitStr1 = 'export const createStudent = async (req: AuthRequest, res: Response): Promise<void> => {';
const splitStr2 = 'export const updateStudent = async (req: AuthRequest, res: Response): Promise<void> => {';
const splitStr3 = 'export const deleteStudent = async (req: AuthRequest, res: Response): Promise<void> => {';

const newCreateStudent = `export const createStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  let { student_code, full_name, phone, phone_number, parent_phone, school, school_name, grade, current_level, email, password } = req.body;
  const user = req.user;

  if (!student_code) {
    student_code = 'HS' + Date.now().toString().slice(-6);
  }
  const phoneToUse = phone || phone_number || '';
  const schoolToUse = school || school_name || '';

  try {
    const result = await pool.query(
      \`INSERT INTO students (student_code, full_name, phone_number, parent_phone, school_name, school, grade, current_level, email) 
       VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8) RETURNING *\`,
      [student_code, full_name, phoneToUse, parent_phone, schoolToUse, grade, current_level, email || null]
    );

    const student = result.rows[0];

    // Tạo tài khoản đăng nhập cho học sinh (Role = 'STUDENT')
    try {
      const username = phoneToUse || student_code;
      const userEmail = email || \`\${username.toLowerCase()}@student.local\`; // Cần cho DB schema cũ nếu email NOT NULL
      const bcrypt = require('bcrypt');
      const passwordHash = await bcrypt.hash(password || '123456', 10);
      
      // Kiểm tra cột username trong users
      try { await pool.query(\`ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(255) UNIQUE;\`); } catch(e){}

      await pool.query(
        \`INSERT INTO users (username, email, password_hash, role, full_name, student_id) VALUES ($1, $2, $3, $4, $5, $6)\`,
        [username, userEmail, passwordHash, 'STUDENT', full_name, student.id]
      );
    } catch (e) {
      console.log('Không thể tạo user tự động cho học sinh:', e);
    }

    res.status(201).json({
      message: 'Thêm học sinh thành công',
      student: student
    });
  } catch (error: any) {
    // Fallback cho schema cũ nếu initCore.sql chưa được chạy hoàn chỉnh
    try {
      const username = phoneToUse || student_code;
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash(password || '123456', 10);
      const fallback = await pool.query(
        \`INSERT INTO students (full_name, phone_number, username, password, teacher_id) 
         VALUES ($1, $2, $3, $4, $5) RETURNING *\`,
        [full_name, phoneToUse, username, hashedPassword, user?.id || null]
      );
      res.status(201).json({
        message: 'Thêm học sinh thành công (schema cũ)',
        student: fallback.rows[0]
      });
    } catch (e) {
      console.error(error);
      res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
  }
};

`;

const newUpdateStudent = `export const updateStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params; 
  const { full_name, phone, phone_number, parent_phone, school, school_name, grade, current_level, email } = req.body; 
  try {
    const phoneToUse = phone_number || phone;
    const schoolToUse = school_name || school;
    const result = await pool.query(
      'UPDATE students SET full_name = $1, phone_number = $2, parent_phone = $3, school_name = $4, school = $4, grade = $5, current_level = $6, email = $7 WHERE id = $8 RETURNING *',
      [full_name, phoneToUse, parent_phone, schoolToUse, grade, current_level, email || null, id]
    );
    res.status(200).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

`;

const part1 = code.split(splitStr1)[0];
// find getProfile360 which is between createStudent and updateStudent
const getProfile360Match = code.match(/export const getProfile360 = async \([\s\S]*?\} catch \(error\) \{[\s\S]*?res\.status\(500\)\.json\(\{ message: 'Lỗi' \}\);\s*\}\s*\};/);
let profileStr = getProfile360Match ? getProfile360Match[0] : '';

const part3 = splitStr3 + code.split(splitStr3)[1];

code = part1 + newCreateStudent + (profileStr ? profileStr + "\n\n" : "") + newUpdateStudent + part3;

fs.writeFileSync('src/controllers/studentController.ts', code);
console.log("Patched studentController.ts heavily");

