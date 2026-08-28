"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addExamScores = exports.markBillAsPaid = exports.createBill = exports.getBills = exports.createPayment = exports.getPayments = void 0;
const db_1 = __importDefault(require("../db")); // <-- Chỉ dùng 1 dòng import chuẩn này thôi
// 1. Lấy lịch sử đóng học phí (Kèm tên học sinh)
const getPayments = async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            res.status(401).json({ message: "Không tìm thấy thông tin xác thực!" });
            return;
        }
        let result;
        if (user.role === 'ADMIN') {
            result = await db_1.default.query(`SELECT p.*, s.full_name FROM payments p JOIN students s ON p.student_id = s.id ORDER BY p.payment_date DESC`);
        }
        else {
            result = await db_1.default.query(`SELECT p.*, s.full_name FROM payments p JOIN students s ON p.student_id = s.id WHERE s.teacher_id = $1 ORDER BY p.payment_date DESC`, [user.id]);
        }
        res.status(200).json(result.rows);
    }
    catch (error) {
        res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
    }
};
exports.getPayments = getPayments;
// 2. Thêm một khoản thu mới (Cũ)
const createPayment = async (req, res) => {
    const { student_id, class_id, amount, payment_method, notes } = req.body;
    try {
        const result = await db_1.default.query(`INSERT INTO payments (student_id, class_id, amount, payment_method, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *`, [student_id, class_id, amount, payment_method, notes]);
        res.status(201).json({ message: 'Lưu giao dịch thành công', payment: result.rows[0] });
    }
    catch (error) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};
exports.createPayment = createPayment;
// 3. Lấy danh sách tất cả các phiếu thu (MỚI)
const getBills = async (req, res) => {
    try {
        const result = await db_1.default.query(`SELECT b.*, s.full_name FROM tuition_bills b JOIN students s ON b.student_id = s.id ORDER BY b.created_at DESC`);
        res.json(result.rows);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.getBills = getBills;
// 4. Tạo phiếu thu mới & Khóa buổi học (MỚI)
const createBill = async (req, res) => {
    const { student_id, start_date, end_date, total_amount, bill_note } = req.body;
    try {
        await db_1.default.query(`INSERT INTO tuition_bills (student_id, start_date, end_date, total_amount, bill_note) VALUES ($1, $2, $3, $4, $5)`, [student_id, start_date, end_date, total_amount, bill_note]);
        await db_1.default.query(`UPDATE session_evaluations SET is_billed = true FROM sessions WHERE session_evaluations.session_id = sessions.id AND session_evaluations.student_id = $1 AND sessions.session_date >= $2 AND sessions.session_date <= $3`, [student_id, start_date, end_date]);
        res.json({ message: 'Tạo phiếu thành công!' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.createBill = createBill;
// 5. Xác nhận Đã Thu Tiền & Bật "Tem xanh" (MỚI)
// 5. Xác nhận Đã Thu Tiền & Bật "Tem xanh" (Đã fix lỗi lệch múi giờ cập nhật)
const markBillAsPaid = async (req, res) => {
    const { id } = req.params;
    try {
        const billRes = await db_1.default.query(`UPDATE tuition_bills SET is_paid = true WHERE id = $1 RETURNING *`, [id]);
        const bill = billRes.rows[0];
        if (bill) {
            // Ép kiểu ngày tháng về định dạng chuỗi cứng YYYY-MM-DD để chặn Node.js tự lùi ngày
            const formatDate = (date) => {
                const d = new Date(date);
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            };
            const startDateStr = formatDate(bill.start_date);
            const endDateStr = formatDate(bill.end_date);
            await db_1.default.query(`UPDATE session_evaluations SET is_paid = true FROM sessions 
         WHERE session_evaluations.session_id = sessions.id 
         AND session_evaluations.student_id = $1 
         AND sessions.session_date >= $2 
         AND sessions.session_date <= $3`, [bill.student_id, startDateStr, endDateStr]);
        }
        res.json({ message: 'Đã xác nhận thanh toán!' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.markBillAsPaid = markBillAsPaid;
// 6. Gắn điểm thi vào hóa đơn (MỚI)
const addExamScores = async (req, res) => {
    const scoresArray = req.body;
    if (!Array.isArray(scoresArray) || scoresArray.length === 0) {
        return res.status(400).json({ message: "Payload không hợp lệ" });
    }
    try {
        for (const item of scoresArray) {
            const { student_id, exam_title, score } = item;
            // Tìm phiếu thu CHƯA THANH TOÁN gần nhất của học sinh đó
            const billRes = await db_1.default.query(`SELECT id, exam_scores FROM tuition_bills 
         WHERE student_id = $1 AND is_paid = false 
         ORDER BY created_at DESC LIMIT 1`, [student_id]);
            if (billRes.rows.length > 0) {
                const bill = billRes.rows[0];
                // Đảm bảo exam_scores là mảng
                let currentScores = Array.isArray(bill.exam_scores) ? bill.exam_scores : (bill.exam_scores ? JSON.parse(bill.exam_scores) : []);
                currentScores.push({ exam_title, score });
                await db_1.default.query(`UPDATE tuition_bills SET exam_scores = $1::jsonb WHERE id = $2`, [JSON.stringify(currentScores), bill.id]);
            }
        }
        res.json({ message: "Đã cập nhật điểm thi vào hóa đơn thành công!" });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.addExamScores = addExamScores;
//# sourceMappingURL=paymentController.js.map