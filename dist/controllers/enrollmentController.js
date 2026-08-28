"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClassesForStudent = exports.getStudentsInClass = exports.deleteEnrollment = exports.updateEnrollmentStatus = exports.enrollStudent = exports.getEnrollments = void 0;
const db_1 = __importDefault(require("../db"));
// 1. Xem danh sách đã xếp lớp (GET) - Dùng JOIN để lấy tên thật thay vì chỉ lấy ID
const getEnrollments = async (req, res) => {
    try {
        const query = `
      SELECT e.id, s.full_name, c.class_name, e.enrollment_date, e.status
      FROM enrollments e
      JOIN students s ON e.student_id = s.id
      JOIN classes c ON e.class_id = c.id
    `;
        const result = await db_1.default.query(query);
        res.status(200).json(result.rows);
    }
    catch (error) {
        console.error("Lỗi lấy danh sách ghi danh:", error);
        res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
    }
};
exports.getEnrollments = getEnrollments;
// 2. Ghi danh học sinh vào lớp (POST)
const enrollStudent = async (req, res) => {
    try {
        const { class_id, student_id } = req.body;
        // 1. THÊM BỘ LỌC KIỂM TRA TRÙNG LẶP
        const checkExist = await db_1.default.query('SELECT * FROM enrollments WHERE class_id = $1 AND student_id = $2', [class_id, student_id]);
        // Nếu câu truy vấn trả về dữ liệu (> 0), nghĩa là học sinh đã ở trong lớp
        if (checkExist.rows.length > 0) {
            res.status(400).json({ message: '❌ Học sinh này đã có trong lớp rồi!' });
            return; // Ngắt mạch, không chạy đoạn code thêm mới phía dưới nữa
        }
        // 2. Lệnh INSERT cũ của bạn giữ nguyên
        const result = await db_1.default.query('INSERT INTO enrollments (class_id, student_id) VALUES ($1, $2) RETURNING *', [class_id, student_id]);
        res.status(201).json({ message: '✅ Đã thêm học sinh vào lớp!', data: result.rows[0] });
    }
    catch (error) {
        console.error("Lỗi khi thêm học sinh vào lớp:", error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};
exports.enrollStudent = enrollStudent;
// 3. Cập nhật trạng thái học tập (PUT)
const updateEnrollmentStatus = async (req, res) => {
    try {
        const { id } = req.params; // ID của lượt ghi danh, không phải ID học sinh
        const { status } = req.body; // Ví dụ: "Bảo lưu", "Đã nghỉ", "Học online"
        const result = await db_1.default.query('UPDATE enrollments SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
        if (result.rows.length === 0) {
            res.status(404).json({ message: "Không tìm thấy thông tin xếp lớp này" });
            return;
        }
        res.status(200).json(result.rows[0]);
    }
    catch (error) {
        console.error("Lỗi khi cập nhật trạng thái:", error);
        res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
    }
};
exports.updateEnrollmentStatus = updateEnrollmentStatus;
// 4. Hủy ghi danh (DELETE)
const deleteEnrollment = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db_1.default.query('DELETE FROM enrollments WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            res.status(404).json({ message: "Không tìm thấy thông tin xếp lớp này" });
            return;
        }
        res.status(200).json({ message: "Đã hủy xếp lớp thành công" });
    }
    catch (error) {
        console.error("Lỗi khi xóa ghi danh:", error);
        res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
    }
};
exports.deleteEnrollment = deleteEnrollment;
// Lấy danh sách các lớp mà một học sinh đang học
// Bổ sung hàm 1: Lấy danh sách học sinh trong một lớp (Dùng cho trang Chi tiết lớp)
const getStudentsInClass = async (req, res) => {
    const { class_id } = req.params;
    try {
        const result = await db_1.default.query(`SELECT s.id, s.full_name, s.phone_number, e.enrollment_date 
       FROM students s
       JOIN enrollments e ON s.id = e.student_id
       WHERE e.class_id = $1`, [class_id]);
        res.status(200).json(result.rows);
    }
    catch (error) {
        res.status(500).json({ message: 'Lỗi server', error });
    }
};
exports.getStudentsInClass = getStudentsInClass;
// Bổ sung hàm 2: Lấy danh sách lớp mà một học sinh đang học (Dùng cho Dropdown mục Học phí)
const getClassesForStudent = async (req, res) => {
    const { student_id } = req.params;
    try {
        const result = await db_1.default.query(`SELECT c.id, c.class_name 
       FROM classes c
       JOIN enrollments e ON c.id = e.class_id
       WHERE e.student_id = $1`, [student_id]);
        res.status(200).json(result.rows);
    }
    catch (error) {
        res.status(500).json({ message: 'Lỗi server', error });
    }
};
exports.getClassesForStudent = getClassesForStudent;
//# sourceMappingURL=enrollmentController.js.map