import { Request, Response } from 'express';
import pool from '../db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    // 1. Tìm người dùng trong database
    const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    
    if (userResult.rows.length === 0) {
      res.status(401).json({ message: "Sai tên đăng nhập hoặc mật khẩu" });
      return;
    }

    const user = userResult.rows[0];

    // 2. So sánh mật khẩu người dùng nhập vào với mật khẩu đã băm trong database
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isPasswordValid) {
      res.status(401).json({ message: "Sai tên đăng nhập hoặc mật khẩu" });
      return;
    }

    // 3. TẠO THẺ TỪ (TOKEN) PHÂN QUYỀN
    // Gói thêm user.role vào trong token để Backend biết đây là Admin hay Teacher
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: '1d' }
    );

    res.status(200).json({
      message: "Đăng nhập thành công",
      token: token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role // Trả về role cho Frontend để hiển thị giao diện phù hợp
      }
    });
  } catch (error) {
    console.error("Lỗi đăng nhập:", error);
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password, role } = req.body; // Nhận thêm role từ giao diện/Postman

    // 1. Tạo "muối" và băm mật khẩu
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 2. Gán quyền mặc định là TEACHER nếu không truyền lên
    const userRole = role || 'TEACHER';

    // 3. Lưu tài khoản cùng mật khẩu đã băm và quyền vào Database
    const newUser = await pool.query(
      'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role',
      [username, hashedPassword, userRole]
    );

    res.status(201).json({
      message: "Tạo tài khoản thành công",
      user: newUser.rows[0]
    });
  } catch (error) {
    console.error("Lỗi đăng ký:", error);
    res.status(500).json({ message: "Lỗi máy chủ hoặc tài khoản đã tồn tại" });
  }
};

// Đăng nhập dành cho Học sinh (Giữ nguyên không đổi)
export const studentLogin = async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;

  try {
    console.log("USERNAME NHẬN ĐƯỢC:", username);

    const result = await pool.query(
      'SELECT id, username, password FROM students WHERE username = $1',
      [username]
    );

    console.log("KẾT QUẢ DATABASE:", result.rows);

    const student = result.rows[0];

    if (!student) {
      res.status(400).json({ message: 'Tài khoản không tồn tại!' });
      return;
    }

    const isMatch = await bcrypt.compare(password, student.password);

    console.log("PASSWORD MATCH:", isMatch);

    if (!isMatch) {
      res.status(400).json({ message: 'Sai mật khẩu!' });
      return;
    }

    const token = jwt.sign(
      { id: student.id, role: 'student', full_name: student.full_name },
      process.env.JWT_SECRET as string,
      { expiresIn: '1d' }
    );

    res.json({
      message: 'Đăng nhập thành công',
      token,
      user: {
        id: student.id,
        full_name: student.full_name,
        role: 'student'
      }
    });
  } catch (error) {
    console.error("LỖI LOGIN STUDENT:", error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};
// Thêm hàm này vào file controller của user/auth
export const getTeachers = async (req: Request, res: Response): Promise<void> => {
  try {
    // Chỉ lấy những user có role là TEACHER
    const result = await pool.query("SELECT id, username FROM users WHERE role = 'TEACHER'");
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi lấy danh sách giáo viên" });
  }
};
// Thêm hàm tạo giáo viên (có lưu full_name)
export const createTeacher = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password, full_name } = req.body;

    // 1. Kiểm tra xem username đã tồn tại chưa
    const userExist = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userExist.rows.length > 0) {
      res.status(400).json({ message: "Tên đăng nhập đã tồn tại!" });
      return;
    }

    // 2. Mã hóa mật khẩu
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Lưu vào Database (nhớ thêm cột full_name)
    const newTeacher = await pool.query(
      'INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id, username, full_name, role',
      [username, hashedPassword, full_name, 'TEACHER']
    );

    res.status(201).json({
      message: "Tạo giáo viên thành công!",
      teacher: newTeacher.rows[0]
    });
  } catch (error) {
    console.error("Lỗi khi tạo giáo viên:", error);
    res.status(500).json({ message: "Lỗi máy chủ khi tạo tài khoản" });
  }
};
// Cấp lại mật khẩu cho Giáo viên
export const resetTeacherPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const teacherId = req.params.id;
    const { newPassword } = req.body;

    // Mã hóa mật khẩu mới
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Cập nhật vào DB
    await pool.query(
      "UPDATE users SET password_hash = $1 WHERE id = $2 AND role = 'TEACHER'",
      [hashedPassword, teacherId]
    );

    res.status(200).json({ message: "Đã cấp lại mật khẩu thành công!" });
  } catch (error) {
    console.error("Lỗi đổi mật khẩu:", error);
    res.status(500).json({ message: "Lỗi máy chủ khi đổi mật khẩu" });
  }
};