import { Request, Response } from 'express';
import pool from '../db'; // <-- Chỉ dùng 1 dòng import chuẩn này thôi

interface AuthRequest extends Request {
  user?: any;
}

// 1. Lấy lịch sử đóng học phí (Kèm tên học sinh)
export const getPayments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ message: "Không tìm thấy thông tin xác thực!" });
      return;
    }
    let result;
    if (user.role === 'ADMIN') {
      result = await pool.query(`SELECT p.*, s.full_name FROM payments p JOIN students s ON p.student_id = s.id ORDER BY p.payment_date DESC`);
    } else {
      result = await pool.query(`SELECT p.*, s.full_name FROM payments p JOIN students s ON p.student_id = s.id WHERE s.teacher_id = $1 ORDER BY p.payment_date DESC`, [user.id]);
    }
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

// 2. Thêm một khoản thu mới (Cũ)
export const createPayment = async (req: Request, res: Response): Promise<void> => {
  const { student_id, class_id, amount, payment_method, notes } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO payments (student_id, class_id, amount, payment_method, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [student_id, class_id, amount, payment_method, notes]
    );
    res.status(201).json({ message: 'Lưu giao dịch thành công', payment: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// 3. Lấy danh sách tất cả các phiếu thu (MỚI)
export const getBills = async (req: any, res: any) => {
  try {
    const result = await pool.query(`SELECT b.*, s.full_name FROM tuition_bills b JOIN students s ON b.student_id = s.id ORDER BY b.created_at DESC`);
    res.json(result.rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
};

// 4. Tạo phiếu thu mới & Khóa buổi học (MỚI)
export const createBill = async (req: any, res: any) => {
  const { student_id, start_date, end_date, total_amount, bill_note } = req.body;
  try {
    await pool.query(`INSERT INTO tuition_bills (student_id, start_date, end_date, total_amount, bill_note) VALUES ($1, $2, $3, $4, $5)`, [student_id, start_date, end_date, total_amount, bill_note]);
    await pool.query(`UPDATE session_evaluations SET is_billed = true FROM sessions WHERE session_evaluations.session_id = sessions.id AND session_evaluations.student_id = $1 AND sessions.session_date >= $2 AND sessions.session_date <= $3`, [student_id, start_date, end_date]);
    res.json({ message: 'Tạo phiếu thành công!' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
};

// 5. Xác nhận Đã Thu Tiền & Bật "Tem xanh" (MỚI)
// 5. Xác nhận Đã Thu Tiền & Bật "Tem xanh" (Đã fix lỗi lệch múi giờ cập nhật)
export const markBillAsPaid = async (req: any, res: any) => {
  const { id } = req.params;
  try {
    const billRes = await pool.query(`UPDATE tuition_bills SET is_paid = true WHERE id = $1 RETURNING *`, [id]);
    const bill = billRes.rows[0];
    
    if(bill) {
      // Ép kiểu ngày tháng về định dạng chuỗi cứng YYYY-MM-DD để chặn Node.js tự lùi ngày
      const formatDate = (date: any) => {
        const d = new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      };
      
      const startDateStr = formatDate(bill.start_date);
      const endDateStr = formatDate(bill.end_date);

      await pool.query(
        `UPDATE session_evaluations SET is_paid = true FROM sessions 
         WHERE session_evaluations.session_id = sessions.id 
         AND session_evaluations.student_id = $1 
         AND sessions.session_date >= $2 
         AND sessions.session_date <= $3`,
        [bill.student_id, startDateStr, endDateStr]
      );
    }
    res.json({ message: 'Đã xác nhận thanh toán!' });
  } catch (err: any) { 
    res.status(500).json({ error: err.message }); 
  }
};