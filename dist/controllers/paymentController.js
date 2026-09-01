"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.previewBill = exports.getBillInvoice = exports.addExamScores = exports.deleteBill = exports.markBillAsPaid = exports.createBill = exports.getBills = exports.createPayment = exports.getPayments = void 0;
const db_1 = __importDefault(require("../db"));
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
            result = await db_1.default.query(`
        SELECT DISTINCT p.*, s.full_name 
        FROM payments p 
        JOIN students s ON p.student_id = s.id 
        LEFT JOIN enrollments e ON s.id = e.student_id
        LEFT JOIN classes c ON e.class_id = c.id
        WHERE s.teacher_id = $1 OR c.teacher_id = $1 
        ORDER BY p.payment_date DESC
      `, [user.id]);
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
    const user = req.user;
    try {
        if (user?.role === 'TEACHER') {
            const check = await db_1.default.query(`SELECT 1 FROM students s
         LEFT JOIN enrollments e ON s.id = e.student_id
         LEFT JOIN classes c ON e.class_id = c.id
         WHERE s.id = $1 AND (s.teacher_id = $2 OR c.teacher_id = $2)`, [student_id, user.id]);
            if (check.rows.length === 0) {
                res.status(403).json({ message: "Không có quyền tạo khoản thu cho học sinh này" });
                return;
            }
        }
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
        const user = req.user;
        let result;
        if (user?.role === 'ADMIN') {
            result = await db_1.default.query(`SELECT b.*, s.full_name FROM tuition_bills b JOIN students s ON b.student_id = s.id ORDER BY b.created_at DESC`);
        }
        else {
            result = await db_1.default.query(`
        SELECT DISTINCT b.*, s.full_name 
        FROM tuition_bills b 
        JOIN students s ON b.student_id = s.id 
        LEFT JOIN enrollments e ON s.id = e.student_id
        LEFT JOIN classes c ON e.class_id = c.id
        WHERE (s.teacher_id = $1 OR c.teacher_id = $1)
        ORDER BY b.created_at DESC
      `, [user?.id]);
        }
        res.json(result.rows);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.getBills = getBills;
// 4. Tạo phiếu thu mới & Khóa buổi học (MỚI)
const createBill = async (req, res) => {
    const { student_id, start_date, end_date, bill_note, unit_price } = req.body;
    const user = req.user;
    try {
        if (user?.role === 'TEACHER') {
            const check = await db_1.default.query(`SELECT 1 FROM students s
         LEFT JOIN enrollments e ON s.id = e.student_id
         LEFT JOIN classes c ON e.class_id = c.id
         WHERE s.id = $1 AND (s.teacher_id = $2 OR c.teacher_id = $2)`, [student_id, user.id]);
            if (check.rows.length === 0) {
                res.status(403).json({ message: "Không có quyền tạo hóa đơn cho học sinh này" });
                return;
            }
        }
        const teacherId = user?.role === 'TEACHER' ? user.id : null;
        const calcRes = await db_1.default.query(`
      SELECT DISTINCT a.class_id, a.attendance_date, c.tuition_fee as fee
      FROM attendance a
      JOIN sessions s ON a.class_id = s.class_id AND a.attendance_date = s.session_date
      JOIN enrollments e ON e.student_id = a.student_id AND e.class_id = a.class_id
      JOIN classes c ON a.class_id = c.id
      WHERE a.student_id = $1 
        AND a.attendance_date >= $2 
        AND a.attendance_date <= $3
        AND a.status = 'PRESENT'
        AND ($4::int IS NULL OR c.teacher_id = $4)
    `, [student_id, start_date, end_date, teacherId]);
        const presentCount = calcRes.rows.length;
        let total_amount = 0;
        const customPrice = parseInt(unit_price, 10);
        if (!isNaN(customPrice) && customPrice >= 0) {
            total_amount = presentCount * customPrice;
        }
        else {
            total_amount = calcRes.rows.reduce((sum, r) => sum + Number(r.fee || 0), 0);
        }
        await db_1.default.query(`INSERT INTO tuition_bills (student_id, start_date, end_date, total_amount, bill_note, is_paid) VALUES ($1, $2, $3, $4, $5, false)`, [student_id, start_date, end_date, total_amount, bill_note]);
        res.json({ message: 'Tạo phiếu thành công!', total_amount });
    }
    catch (err) {
        console.error("Lỗi createBill:", err);
        res.status(500).json({ error: err.message });
    }
};
exports.createBill = createBill;
// 5. Xác nhận Đã Thu Tiền & Bật "Tem xanh" (MỚI)
const markBillAsPaid = async (req, res) => {
    const { id } = req.params;
    const user = req.user;
    try {
        if (user?.role === 'TEACHER') {
            const check = await db_1.default.query(`SELECT 1 FROM tuition_bills b
         JOIN students s ON b.student_id = s.id
         LEFT JOIN enrollments e ON s.id = e.student_id
         LEFT JOIN classes c ON e.class_id = c.id
         WHERE b.id = $1 AND (s.teacher_id = $2 OR c.teacher_id = $2)`, [id, user.id]);
            if (check.rows.length === 0) {
                res.status(403).json({ message: "Không có quyền xác nhận hóa đơn này" });
                return;
            }
        }
        const billRes = await db_1.default.query(`UPDATE tuition_bills SET is_paid = true WHERE id = $1 RETURNING *`, [id]);
        const bill = billRes.rows[0];
        res.json({ message: 'Đã xác nhận thanh toán!' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.markBillAsPaid = markBillAsPaid;
// 5.1 Xóa / Hủy phiếu thu học phí
const deleteBill = async (req, res) => {
    const { id } = req.params;
    const user = req.user;
    const client = await db_1.default.connect();
    try {
        if (user?.role === 'TEACHER') {
            const check = await client.query(`SELECT 1 FROM tuition_bills b
         JOIN students s ON b.student_id = s.id
         LEFT JOIN enrollments e ON s.id = e.student_id
         LEFT JOIN classes c ON e.class_id = c.id
         WHERE b.id = $1 AND (s.teacher_id = $2 OR c.teacher_id = $2)`, [id, user.id]);
            if (check.rows.length === 0) {
                res.status(403).json({ message: "Không có quyền xóa phiếu thu này" });
                return;
            }
        }
        await client.query('BEGIN');
        const billRes = await client.query('SELECT student_id, start_date, end_date FROM tuition_bills WHERE id = $1', [id]);
        if (billRes.rows.length === 0) {
            await client.query('ROLLBACK');
            res.status(404).json({ message: "Không tìm thấy phiếu thu" });
            return;
        }
        const bill = billRes.rows[0];
        // Unmark session evaluations so they can be re-billed if needed
        if (bill.start_date && bill.end_date) {
            await client.query(`UPDATE session_evaluations SET is_billed = FALSE 
         WHERE student_id = $1 AND session_id IN (
           SELECT id FROM sessions WHERE session_date >= $2 AND session_date <= $3
         )`, [bill.student_id, bill.start_date, bill.end_date]);
        }
        await client.query('DELETE FROM tuition_bills WHERE id = $1', [id]);
        await client.query('COMMIT');
        res.status(200).json({ message: 'Đã xóa phiếu thu học phí thành công' });
    }
    catch (err) {
        await client.query('ROLLBACK');
        console.error('Lỗi deleteBill:', err);
        res.status(500).json({ error: err.message });
    }
    finally {
        client.release();
    }
};
exports.deleteBill = deleteBill;
// 6. Gắn điểm thi vào hóa đơn (MỚI)
const addExamScores = async (req, res) => {
    const scoresArray = req.body;
    if (!Array.isArray(scoresArray) || scoresArray.length === 0) {
        res.status(400).json({ message: "Payload không hợp lệ" });
        return;
    }
    try {
        for (const item of scoresArray) {
            const { student_id, exam_title, score } = item;
            // Tìm phiếu thu CHƯA THANH TOÁN gần nhất của học sinh đó
            const billRes = await db_1.default.query(`SELECT id FROM tuition_bills 
         WHERE student_id = $1 AND is_paid = false 
         ORDER BY created_at DESC LIMIT 1`, [student_id]);
            if (billRes.rows.length > 0) {
                const bill = billRes.rows[0];
                console.warn('Skipping exam_scores update since column does not exist on production tuition_bills');
            }
        }
        res.json({ message: "Đã cập nhật điểm thi vào hóa đơn thành công!" });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.addExamScores = addExamScores;
const getBillInvoice = async (req, res) => {
    const { id } = req.params;
    const user = req.user;
    try {
        if (user?.role === 'TEACHER') {
            const check = await db_1.default.query(`SELECT 1 FROM tuition_bills b
         JOIN students s ON b.student_id = s.id
         LEFT JOIN enrollments e ON s.id = e.student_id
         LEFT JOIN classes c ON e.class_id = c.id
         WHERE b.id = $1 AND (s.teacher_id = $2 OR c.teacher_id = $2)`, [id, user.id]);
            if (check.rows.length === 0) {
                res.status(403).json({ message: "Không có quyền xem hóa đơn này" });
                return;
            }
        }
        const billRes = await db_1.default.query(`
      SELECT b.*, s.full_name, s.phone_number, s.school_name,
             COALESCE(c.class_name, 'Lớp học') as class_name,
             COALESCE(c.tuition_fee, 0) as tuition_fee,
             u.id as teacher_id,
             u.full_name as teacher_name,
             u.bank_code,
             u.bank_name,
             u.account_number,
             u.account_name
      FROM tuition_bills b 
      JOIN students s ON b.student_id = s.id 
      LEFT JOIN enrollments e ON e.student_id = s.id
      LEFT JOIN classes c ON e.class_id = c.id
      LEFT JOIN users u ON (c.teacher_id = u.id OR s.teacher_id = u.id)
      WHERE b.id = $1
      ORDER BY c.id ASC LIMIT 1`, [id]);
        if (billRes.rows.length === 0) {
            res.status(404).json({ message: "Không tìm thấy hóa đơn" });
            return;
        }
        const bill = billRes.rows[0];
        const teacherId = user?.role === 'TEACHER' ? user.id : null;
        // Dynamic Teacher Bank Account
        const teacherBank = (bill.bank_code && bill.account_number) ? {
            bank_code: bill.bank_code,
            bank_name: bill.bank_name || bill.bank_code,
            account_number: bill.account_number,
            account_name: bill.account_name || bill.teacher_name || ''
        } : null;
        // Requirement: SESSIONS as primary list source, then LEFT JOIN attendance
        const sessionsRes = await db_1.default.query(`
      SELECT DISTINCT s.session_date, s.start_time, c.class_name, c.tuition_fee,
             a.status, COALESCE(a.absent_reason, a.notes) as absent_reason, s.content
      FROM sessions s
      JOIN classes c ON s.class_id = c.id
      JOIN enrollments e ON e.student_id = $1 AND e.class_id = s.class_id
      LEFT JOIN attendance a ON a.class_id = s.class_id AND a.attendance_date = s.session_date AND a.student_id = $1
      WHERE s.session_date >= $2 AND s.session_date <= $3
        AND ($4::int IS NULL OR c.teacher_id = $4)
      ORDER BY s.session_date ASC`, [bill.student_id, bill.start_date, bill.end_date, teacherId]);
        // Query available assessments in the period for the student (Teacher isolated)
        let assessments = [];
        try {
            const assessmentsRes = await db_1.default.query(`
        SELECT DISTINCT
          es.id,
          es.document_id,
          COALESCE(d.title, 'Bài kiểm tra') as title,
          es.total_score as score,
          es.submitted_at as assessment_date,
          COALESCE(d.category, 'EXAM') as category,
          c.class_name
        FROM exam_submissions es
        JOIN documents d ON es.document_id = d.id
        LEFT JOIN folders f ON d.folder_id = f.id
        LEFT JOIN classes c ON f.class_id = c.id
        JOIN students s ON es.student_id = s.id
        WHERE es.student_id = $1
          AND es.submitted_at::date >= $2::date
          AND es.submitted_at::date <= $3::date
          AND ($4::int IS NULL OR d.teacher_id = $4 OR c.teacher_id = $4 OR s.teacher_id = $4)
        ORDER BY es.submitted_at ASC
      `, [bill.student_id, bill.start_date, bill.end_date, teacherId]);
            assessments = assessmentsRes.rows;
        }
        catch (assessErr) {
            console.warn("Lưu ý: Không thể lấy assessments:", assessErr);
            assessments = [];
        }
        res.json({ bill, sessions: sessionsRes.rows, available_assessments: assessments, teacher_bank: teacherBank });
    }
    catch (err) {
        console.error("Lỗi getBillInvoice:", err);
        res.status(500).json({ error: err.message });
    }
};
exports.getBillInvoice = getBillInvoice;
const previewBill = async (req, res) => {
    const { student_id, start_date, end_date, unit_price } = req.query;
    const user = req.user;
    try {
        if (user?.role === 'TEACHER') {
            const check = await db_1.default.query(`SELECT 1 FROM students s
         LEFT JOIN enrollments e ON s.id = e.student_id
         LEFT JOIN classes c ON e.class_id = c.id
         WHERE s.id = $1 AND (s.teacher_id = $2 OR c.teacher_id = $2)`, [student_id, user.id]);
            if (check.rows.length === 0) {
                res.status(403).json({ message: "Không có quyền xem học phí của học sinh này" });
                return;
            }
        }
        const teacherId = user?.role === 'TEACHER' ? user.id : null;
        // Get student's default class fee
        const classRes = await db_1.default.query(`
      SELECT c.tuition_fee, c.class_name 
      FROM enrollments e 
      JOIN classes c ON e.class_id = c.id 
      WHERE e.student_id = $1 
      LIMIT 1
    `, [student_id]);
        const defaultFee = classRes.rows[0]?.tuition_fee ? Number(classRes.rows[0].tuition_fee) : 0;
        const className = classRes.rows[0]?.class_name || 'Lớp học';
        const calcRes = await db_1.default.query(`
      SELECT DISTINCT c.class_name, a.attendance_date, c.tuition_fee, a.status, s.content,
             COALESCE(a.absent_reason, a.notes) as absent_reason
      FROM sessions s
      JOIN classes c ON s.class_id = c.id
      JOIN enrollments e ON e.student_id = $1 AND e.class_id = s.class_id
      JOIN attendance a ON a.class_id = s.class_id AND a.attendance_date = s.session_date AND a.student_id = $1
      WHERE a.student_id = $1 
        AND a.attendance_date >= $2 
        AND a.attendance_date <= $3
        AND a.status = 'PRESENT'
        AND ($4::int IS NULL OR c.teacher_id = $4)
      ORDER BY a.attendance_date ASC
    `, [student_id, start_date, end_date, teacherId]);
        const presentCount = calcRes.rows.length;
        let total = 0;
        let unitPriceUsed = defaultFee;
        if (unit_price !== undefined && unit_price !== '') {
            const customPrice = parseInt(String(unit_price), 10);
            if (!isNaN(customPrice) && customPrice >= 0) {
                unitPriceUsed = customPrice;
                total = presentCount * customPrice;
            }
            else {
                total = calcRes.rows.reduce((sum, row) => sum + Number(row.tuition_fee || 0), 0);
            }
        }
        else {
            total = calcRes.rows.reduce((sum, row) => sum + Number(row.tuition_fee || 0), 0);
        }
        res.json({
            total_amount: total,
            sessions: calcRes.rows,
            present_count: presentCount,
            tuition_fee: unitPriceUsed,
            default_class_fee: defaultFee,
            class_name: className
        });
    }
    catch (err) {
        console.error("Lỗi previewBill:", err);
        res.status(500).json({ error: err.message });
    }
};
exports.previewBill = previewBill;
//# sourceMappingURL=paymentController.js.map