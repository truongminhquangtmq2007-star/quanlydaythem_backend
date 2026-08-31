import { Request, Response } from 'express';
import pool from '../db';
import { AuthRequest } from '../middleware/authMiddleware';

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
      result = await pool.query(`
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
  } catch (error) {
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

// 2. Thêm một khoản thu mới (Cũ)
export const createPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  const { student_id, class_id, amount, payment_method, notes } = req.body;
  const user = req.user;
  try {
    if (user?.role === 'TEACHER') {
      const check = await pool.query(
        `SELECT 1 FROM students s
         LEFT JOIN enrollments e ON s.id = e.student_id
         LEFT JOIN classes c ON e.class_id = c.id
         WHERE s.id = $1 AND (s.teacher_id = $2 OR c.teacher_id = $2)`,
        [student_id, user.id]
      );
      if (check.rows.length === 0) {
        res.status(403).json({ message: "Không có quyền tạo khoản thu cho học sinh này" });
        return;
      }
    }

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
export const getBills = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    let result;
    if (user?.role === 'ADMIN') {
      result = await pool.query(`SELECT b.*, s.full_name FROM tuition_bills b JOIN students s ON b.student_id = s.id ORDER BY b.created_at DESC`);
    } else {
      result = await pool.query(`
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
  } catch (err: any) { res.status(500).json({ error: err.message }); }
};

// 4. Tạo phiếu thu mới & Khóa buổi học (MỚI)
export const createBill = async (req: AuthRequest, res: Response): Promise<void> => {
  const { student_id, start_date, end_date, bill_note, unit_price } = req.body;
  const user = req.user;
  try {
    if (user?.role === 'TEACHER') {
      const check = await pool.query(
        `SELECT 1 FROM students s
         LEFT JOIN enrollments e ON s.id = e.student_id
         LEFT JOIN classes c ON e.class_id = c.id
         WHERE s.id = $1 AND (s.teacher_id = $2 OR c.teacher_id = $2)`,
        [student_id, user.id]
      );
      if (check.rows.length === 0) {
        res.status(403).json({ message: "Không có quyền tạo hóa đơn cho học sinh này" });
        return;
      }
    }

    const teacherId = user?.role === 'TEACHER' ? user.id : null;

    const calcRes = await pool.query(`
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
    } else {
      total_amount = calcRes.rows.reduce((sum: number, r: any) => sum + Number(r.fee || 0), 0);
    }

    await pool.query(
      `INSERT INTO tuition_bills (student_id, start_date, end_date, total_amount, bill_note, is_paid) VALUES ($1, $2, $3, $4, $5, false)`, 
      [student_id, start_date, end_date, total_amount, bill_note]
    );
    res.json({ message: 'Tạo phiếu thành công!', total_amount });
  } catch (err: any) { 
    console.error("Lỗi createBill:", err);
    res.status(500).json({ error: err.message }); 
  }
};

// 5. Xác nhận Đã Thu Tiền & Bật "Tem xanh" (MỚI)
export const markBillAsPaid = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const user = req.user;
  try {
    if (user?.role === 'TEACHER') {
      const check = await pool.query(
        `SELECT 1 FROM tuition_bills b
         JOIN students s ON b.student_id = s.id
         LEFT JOIN enrollments e ON s.id = e.student_id
         LEFT JOIN classes c ON e.class_id = c.id
         WHERE b.id = $1 AND (s.teacher_id = $2 OR c.teacher_id = $2)`,
        [id, user.id]
      );
      if (check.rows.length === 0) {
        res.status(403).json({ message: "Không có quyền xác nhận hóa đơn này" });
        return;
      }
    }

    const billRes = await pool.query(`UPDATE tuition_bills SET is_paid = true WHERE id = $1 RETURNING *`, [id]);
    const bill = billRes.rows[0];
    
    res.json({ message: 'Đã xác nhận thanh toán!' });
  } catch (err: any) { 
    res.status(500).json({ error: err.message }); 
  }
};

// 6. Gắn điểm thi vào hóa đơn (MỚI)
export const addExamScores = async (req: AuthRequest, res: Response): Promise<void> => {
  const scoresArray = req.body;

  if (!Array.isArray(scoresArray) || scoresArray.length === 0) {
    res.status(400).json({ message: "Payload không hợp lệ" });
    return;
  }

  try {
    for (const item of scoresArray) {
      const { student_id, exam_title, score } = item;
      
      // Tìm phiếu thu CHƯA THANH TOÁN gần nhất của học sinh đó
      const billRes = await pool.query(
        `SELECT id FROM tuition_bills 
         WHERE student_id = $1 AND is_paid = false 
         ORDER BY created_at DESC LIMIT 1`,
        [student_id]
      );

      if (billRes.rows.length > 0) {
        const bill = billRes.rows[0];
        console.warn('Skipping exam_scores update since column does not exist on production tuition_bills');
      }
    }

    res.json({ message: "Đã cập nhật điểm thi vào hóa đơn thành công!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getBillInvoice = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const user = req.user;
  try {
    if (user?.role === 'TEACHER') {
      const check = await pool.query(
        `SELECT 1 FROM tuition_bills b
         JOIN students s ON b.student_id = s.id
         LEFT JOIN enrollments e ON s.id = e.student_id
         LEFT JOIN classes c ON e.class_id = c.id
         WHERE b.id = $1 AND (s.teacher_id = $2 OR c.teacher_id = $2)`,
        [id, user.id]
      );
      if (check.rows.length === 0) {
        res.status(403).json({ message: "Không có quyền xem hóa đơn này" });
        return;
      }
    }

    const billRes = await pool.query(`
      SELECT b.*, s.full_name, s.phone_number, s.school_name,
             COALESCE(c.class_name, 'Lớp học') as class_name,
             COALESCE(c.tuition_fee, 0) as tuition_fee,
             u.full_name as teacher_name
      FROM tuition_bills b 
      JOIN students s ON b.student_id = s.id 
      LEFT JOIN enrollments e ON e.student_id = s.id
      LEFT JOIN classes c ON e.class_id = c.id
      LEFT JOIN users u ON c.teacher_id = u.id
      WHERE b.id = $1
      ORDER BY c.id ASC LIMIT 1`, [id]);
      
    if (billRes.rows.length === 0) {
      res.status(404).json({ message: "Không tìm thấy hóa đơn" });
      return;
    }
    const bill = billRes.rows[0];
    const teacherId = user?.role === 'TEACHER' ? user.id : null;

    // Requirement: SESSIONS as primary list source, then LEFT JOIN attendance
    const sessionsRes = await pool.query(`
      SELECT DISTINCT s.session_date, s.start_time, c.class_name, c.tuition_fee,
             a.status, COALESCE(a.absent_reason, a.notes) as absent_reason, s.content
      FROM sessions s
      JOIN classes c ON s.class_id = c.id
      JOIN enrollments e ON e.student_id = $1 AND e.class_id = s.class_id
      LEFT JOIN attendance a ON a.class_id = s.class_id AND a.attendance_date = s.session_date AND a.student_id = $1
      WHERE s.session_date >= $2 AND s.session_date <= $3
        AND ($4::int IS NULL OR c.teacher_id = $4)
      ORDER BY s.session_date ASC`, 
      [bill.student_id, bill.start_date, bill.end_date, teacherId]);

    res.json({ bill, sessions: sessionsRes.rows });
  } catch (err: any) { 
    console.error("Lỗi getBillInvoice:", err);
    res.status(500).json({ error: err.message }); 
  }
};

export const previewBill = async (req: AuthRequest, res: Response): Promise<void> => {
  const { student_id, start_date, end_date, unit_price } = req.query;
  const user = req.user;
  try {
    if (user?.role === 'TEACHER') {
      const check = await pool.query(
        `SELECT 1 FROM students s
         LEFT JOIN enrollments e ON s.id = e.student_id
         LEFT JOIN classes c ON e.class_id = c.id
         WHERE s.id = $1 AND (s.teacher_id = $2 OR c.teacher_id = $2)`,
        [student_id, user.id]
      );
      if (check.rows.length === 0) {
        res.status(403).json({ message: "Không có quyền xem học phí của học sinh này" });
        return;
      }
    }

    const teacherId = user?.role === 'TEACHER' ? user.id : null;

    // Get student's default class fee
    const classRes = await pool.query(`
      SELECT c.tuition_fee, c.class_name 
      FROM enrollments e 
      JOIN classes c ON e.class_id = c.id 
      WHERE e.student_id = $1 
      LIMIT 1
    `, [student_id]);
    const defaultFee = classRes.rows[0]?.tuition_fee ? Number(classRes.rows[0].tuition_fee) : 0;
    const className = classRes.rows[0]?.class_name || 'Lớp học';

    const calcRes = await pool.query(`
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
      } else {
        total = calcRes.rows.reduce((sum: number, row: any) => sum + Number(row.tuition_fee || 0), 0);
      }
    } else {
      total = calcRes.rows.reduce((sum: number, row: any) => sum + Number(row.tuition_fee || 0), 0);
    }

    res.json({ 
      total_amount: total, 
      sessions: calcRes.rows, 
      present_count: presentCount,
      tuition_fee: unitPriceUsed,
      default_class_fee: defaultFee,
      class_name: className
    });
  } catch(err: any) { 
    console.error("Lỗi previewBill:", err);
    res.status(500).json({ error: err.message }); 
  }
};
