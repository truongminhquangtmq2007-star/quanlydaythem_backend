"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProfile = exports.getMe = exports.resetTeacherPassword = exports.createTeacher = exports.getTeachers = exports.studentLogin = exports.register = exports.login = void 0;
const db_1 = __importDefault(require("../db"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const login = async (req, res) => {
    try {
        const { username, password } = req.body;
        // 1. Tìm người dùng trong database
        const userResult = await db_1.default.query('SELECT * FROM users WHERE username = $1', [username]);
        if (userResult.rows.length === 0) {
            res.status(401).json({ message: "Sai tên đăng nhập hoặc mật khẩu" });
            return;
        }
        const user = userResult.rows[0];
        // 2. So sánh mật khẩu người dùng nhập vào với mật khẩu đã băm trong database
        const isPasswordValid = await bcryptjs_1.default.compare(password, user.password_hash);
        if (!isPasswordValid) {
            res.status(401).json({ message: "Sai tên đăng nhập hoặc mật khẩu" });
            return;
        }
        // 3. TẠO THẺ TỪ (TOKEN) PHÂN QUYỀN
        const token = jsonwebtoken_1.default.sign({ id: user.id, username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.status(200).json({
            message: "Đăng nhập thành công",
            token: token,
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                role: user.role,
                title: user.title,
                bank_code: user.bank_code,
                bank_name: user.bank_name,
                account_number: user.account_number,
                account_name: user.account_name
            }
        });
    }
    catch (error) {
        console.error("Lỗi đăng nhập:", error);
        res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
    }
};
exports.login = login;
const register = async (req, res) => {
    try {
        const { username, password, role } = req.body;
        const salt = await bcryptjs_1.default.genSalt(10);
        const hashedPassword = await bcryptjs_1.default.hash(password, salt);
        const userRole = role || 'TEACHER';
        const newUser = await db_1.default.query('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role', [username, hashedPassword, userRole]);
        res.status(201).json({
            message: "Tạo tài khoản thành công",
            user: newUser.rows[0]
        });
    }
    catch (error) {
        console.error("Lỗi đăng ký:", error);
        res.status(500).json({ message: "Lỗi máy chủ hoặc tài khoản đã tồn tại" });
    }
};
exports.register = register;
// Đăng nhập dành cho Học sinh 
const studentLogin = async (req, res) => {
    const identifier = req.body.identifier || req.body.username;
    const password = req.body.password;
    try {
        const query = `
      SELECT u.id, u.username, u.password_hash, u.full_name, u.student_id, u.title 
        FROM users u
        LEFT JOIN students s ON u.student_id = s.id
        WHERE (u.username = $1 OR s.phone_number = $1) AND u.role = 'STUDENT'
        UNION
        SELECT s.id, s.username, s.password as password_hash, s.full_name, s.id as student_id, 'Học sinh' as title
        FROM students s
        WHERE (s.username = $1 OR s.phone_number = $1) AND s.password IS NOT NULL
    `;
        const result = await db_1.default.query(query, [identifier]);
        const user = result.rows[0];
        if (!user) {
            res.status(400).json({ message: 'Tài khoản không tồn tại!' });
            return;
        }
        const isMatch = await bcryptjs_1.default.compare(password, user.password_hash);
        if (!isMatch) {
            res.status(400).json({ message: 'Sai mật khẩu!' });
            return;
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id, role: 'STUDENT', full_name: user.full_name, student_id: user.student_id }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.json({
            message: 'Đăng nhập thành công',
            token,
            user: {
                id: user.id,
                full_name: user.full_name,
                role: 'STUDENT',
                student_id: user.student_id,
                title: user.title
            }
        });
    }
    catch (error) {
        console.error("LỖI LOGIN STUDENT:", error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};
exports.studentLogin = studentLogin;
const getTeachers = async (req, res) => {
    try {
        const result = await db_1.default.query("SELECT id, username, full_name, bank_code, bank_name, account_number, account_name FROM users WHERE role = 'TEACHER'");
        res.status(200).json(result.rows);
    }
    catch (error) {
        res.status(500).json({ message: "Lỗi khi lấy danh sách giáo viên" });
    }
};
exports.getTeachers = getTeachers;
const createTeacher = async (req, res) => {
    try {
        const { username, password, full_name } = req.body;
        const userExist = await db_1.default.query('SELECT * FROM users WHERE username = $1', [username]);
        if (userExist.rows.length > 0) {
            res.status(400).json({ message: "Tên đăng nhập đã tồn tại!" });
            return;
        }
        const salt = await bcryptjs_1.default.genSalt(10);
        const hashedPassword = await bcryptjs_1.default.hash(password, salt);
        const newTeacher = await db_1.default.query('INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id, username, full_name, role', [username, hashedPassword, full_name, 'TEACHER']);
        res.status(201).json({
            message: "Tạo giáo viên thành công!",
            teacher: newTeacher.rows[0]
        });
    }
    catch (error) {
        console.error("Lỗi khi tạo giáo viên:", error);
        res.status(500).json({ message: "Lỗi máy chủ khi tạo tài khoản" });
    }
};
exports.createTeacher = createTeacher;
const resetTeacherPassword = async (req, res) => {
    try {
        const teacherId = req.params.id;
        const { newPassword } = req.body;
        const salt = await bcryptjs_1.default.genSalt(10);
        const hashedPassword = await bcryptjs_1.default.hash(newPassword, salt);
        await db_1.default.query("UPDATE users SET password_hash = $1 WHERE id = $2 AND role = 'TEACHER'", [hashedPassword, teacherId]);
        res.status(200).json({ message: "Đã cấp lại mật khẩu thành công!" });
    }
    catch (error) {
        console.error("Lỗi đổi mật khẩu:", error);
        res.status(500).json({ message: "Lỗi máy chủ khi đổi mật khẩu" });
    }
};
exports.resetTeacherPassword = resetTeacherPassword;
const getMe = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Chưa xác thực' });
            return;
        }
        const result = await db_1.default.query('SELECT id, username, full_name, role, title, bank_code, bank_name, account_number, account_name FROM users WHERE id = $1', [req.user.id]);
        if (result.rows.length === 0) {
            res.status(404).json({ message: 'Không tìm thấy người dùng' });
            return;
        }
        res.status(200).json(result.rows[0]);
    }
    catch (error) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};
exports.getMe = getMe;
const updateProfile = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Chưa xác thực' });
            return;
        }
        const { full_name, title, bank_code, bank_name, account_number, account_name } = req.body;
        const result = await db_1.default.query(`UPDATE users 
       SET full_name = COALESCE($1, full_name), 
           title = COALESCE($2, title),
           bank_code = $3,
           bank_name = $4,
           account_number = $5,
           account_name = $6
       WHERE id = $7 
       RETURNING id, username, full_name, role, title, bank_code, bank_name, account_number, account_name`, [
            full_name,
            title,
            bank_code ? String(bank_code).trim() : null,
            bank_name ? String(bank_name).trim() : null,
            account_number ? String(account_number).trim() : null,
            account_name ? String(account_name).trim() : null,
            req.user.id
        ]);
        if (result.rows.length === 0) {
            res.status(404).json({ message: 'Không tìm thấy người dùng' });
            return;
        }
        res.status(200).json({ message: 'Cập nhật thành công', user: result.rows[0] });
    }
    catch (error) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};
exports.updateProfile = updateProfile;
//# sourceMappingURL=authController.js.map