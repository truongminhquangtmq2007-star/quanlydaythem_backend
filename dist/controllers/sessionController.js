"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncCalendar = exports.markSessionsAsBilled = exports.saveEvaluation = exports.getEvaluations = exports.getPublishedSessions = exports.deleteSession = exports.publishSessions = exports.upsertSession = exports.getSessions = void 0;
const db_1 = __importDefault(require("../db"));
const googleapis_1 = require("googleapis");
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'dummy_id';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'dummy_secret';
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://quanlydaythem-api.onrender.com/api/calendar/callback';
// 1. Hàm lấy danh sách buổi học
// 1. Hàm lấy danh sách buổi học (Hỗ trợ xem Lịch Tổng)
// 1. Hàm lấy danh sách buổi học (Hỗ trợ xem Lịch Tổng & Đếm đánh giá)
const getSessions = async (req, res) => {
    const { class_id } = req.query;
    const user = req.user;
    try {
        let result;
        if (class_id) {
            result = await db_1.default.query(`SELECT s.*, 
                (SELECT COUNT(*) FROM session_evaluations WHERE session_id = s.id) as eval_count
         FROM sessions s WHERE class_id = $1 ORDER BY session_date ASC`, [class_id]);
        }
        else {
            result = await db_1.default.query(`SELECT s.*, c.class_name,
                (SELECT COUNT(*) FROM session_evaluations WHERE session_id = s.id) as eval_count
         FROM sessions s 
         JOIN classes c ON s.class_id = c.id 
         WHERE c.teacher_id = $1 ORDER BY s.session_date ASC`, [user.id]);
        }
        res.status(200).json(result.rows);
    }
    catch (error) {
        console.error("Lỗi lấy danh sách buổi học:", error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};
exports.getSessions = getSessions;
// 2. API Lưu Nháp / Cập nhật buổi học (ĐÃ GỌT LẠI CHO KHỚP DB)
const upsertSession = async (req, res) => {
    const { id, class_id, session_date, start_time, content, homework } = req.body;
    try {
        let result;
        if (id) {
            result = await db_1.default.query(`UPDATE sessions 
         SET session_date=$1, start_time=$2, content=$3, homework=$4 
         WHERE id=$5 RETURNING *`, [session_date, start_time, content, homework, id]);
        }
        else {
            result = await db_1.default.query(`INSERT INTO sessions (class_id, session_date, start_time, content, homework, is_published) 
         VALUES ($1, $2, $3, $4, $5, false) RETURNING *`, [class_id, session_date, start_time, content, homework]);
        }
        res.status(200).json({ message: 'Đã lưu nháp thành công!', session: result.rows[0] });
    }
    catch (error) {
        console.error("Lỗi lưu buổi học:", error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};
exports.upsertSession = upsertSession;
// 3. API Chốt Sổ & Công Bố
// 3. API Chốt Sổ & Công Bố (Đã sửa lỗi mất dòng)
const publishSessions = async (req, res) => {
    const { class_id } = req.body;
    try {
        // Chốt toàn bộ các bản nháp của lớp đang được chọn
        await db_1.default.query(`UPDATE sessions SET is_published = true WHERE class_id = $1`, [class_id]);
        res.status(200).json({ message: '🚀 Đã công bố lịch học cho Phụ huynh!' });
    }
    catch (error) {
        res.status(500).json({ message: 'Lỗi khi công bố' });
    }
};
exports.publishSessions = publishSessions;
// 4. API XÓA BUỔI HỌC
const deleteSession = async (req, res) => {
    const { id } = req.params;
    try {
        await db_1.default.query('DELETE FROM sessions WHERE id = $1', [id]);
        res.status(200).json({ message: 'Đã xóa buổi học' });
    }
    catch (error) {
        res.status(500).json({ message: 'Lỗi khi xóa' });
    }
};
exports.deleteSession = deleteSession;
// Hàm dành riêng cho Học sinh/Phụ huynh (Chỉ lấy các buổi đã công bố)
// Hàm dành riêng cho Học sinh/Phụ huynh (Đã nâng cấp để lấy cả Nhận xét)
// Hàm dành riêng cho Học sinh/Phụ huynh (Đã bỏ giới hạn class_id)
// Hàm dành riêng cho Học sinh/Phụ huynh (Đã thêm is_paid để hiện Tem xanh)
// Hàm dành riêng cho Học sinh/Phụ huynh (Đã sắp xếp Mới nhất lên đầu)
const getPublishedSessions = async (req, res) => {
    const { student_id } = req.query;
    try {
        const result = await db_1.default.query(`SELECT s.*, 
              e.is_present, e.focus_level, e.teacher_notes, e.is_billed, e.is_paid 
       FROM sessions s
       LEFT JOIN session_evaluations e ON s.id = e.session_id AND e.student_id = $1
       WHERE s.is_published = true 
       ORDER BY s.session_date DESC, s.start_time DESC`, // <-- Sửa ASC thành DESC ở đây
        [student_id]);
        res.status(200).json(result.rows);
    }
    catch (error) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};
exports.getPublishedSessions = getPublishedSessions;
// 5. Lấy danh sách đánh giá của 1 buổi học cụ thể
const getEvaluations = async (req, res) => {
    const { session_id } = req.query;
    try {
        const result = await db_1.default.query(`SELECT e.*, s.full_name as student_name 
       FROM session_evaluations e 
       JOIN students s ON e.student_id = s.id 
       WHERE e.session_id = $1`, [session_id]);
        res.status(200).json(result.rows);
    }
    catch (error) {
        console.error("Lỗi lấy danh sách điểm danh:", error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};
exports.getEvaluations = getEvaluations;
// 6. Lưu điểm danh & nhận xét cho từng học sinh
const saveEvaluation = async (req, res) => {
    const { session_id, student_id, is_present, focus_level, teacher_notes } = req.body;
    try {
        // Kiểm tra xem bé này đã được chấm điểm trong buổi này chưa
        const check = await db_1.default.query(`SELECT id FROM session_evaluations WHERE session_id = $1 AND student_id = $2`, [session_id, student_id]);
        if (check.rows.length > 0) {
            // Nếu có rồi thì Cập nhật (Update)
            await db_1.default.query(`UPDATE session_evaluations SET is_present=$1, focus_level=$2, teacher_notes=$3 WHERE id=$4`, [is_present, focus_level, teacher_notes, check.rows[0].id]);
        }
        else {
            // Nếu chưa có thì Thêm mới (Insert)
            await db_1.default.query(`INSERT INTO session_evaluations (session_id, student_id, is_present, focus_level, teacher_notes) 
         VALUES ($1, $2, $3, $4, $5)`, [session_id, student_id, is_present, focus_level, teacher_notes]);
        }
        res.status(200).json({ message: '✅ Đã lưu đánh giá thành công!' });
    }
    catch (error) {
        console.error("Lỗi lưu đánh giá:", error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};
exports.saveEvaluation = saveEvaluation;
// API: Chốt học phí (Đánh dấu các buổi đã học là Đã thanh toán)
const markSessionsAsBilled = async (req, res) => {
    const { student_id, start_date, end_date } = req.body;
    try {
        // Tìm các buổi học của học sinh này trong khoảng thời gian đã chọn, có đi học và CHƯA thanh toán, sau đó gạt công tắc thành TRUE
        await db_1.default.query(`UPDATE session_evaluations
       SET is_billed = true
       FROM sessions
       WHERE session_evaluations.session_id = sessions.id
         AND session_evaluations.student_id = $1
         AND sessions.session_date >= $2
         AND sessions.session_date <= $3
         AND session_evaluations.is_present = true
         AND session_evaluations.is_billed = false`, [student_id, start_date, end_date]);
        res.status(200).json({ message: 'Đã chốt sổ thành công!' });
    }
    catch (error) {
        console.error("Lỗi chốt học phí:", error);
        res.status(500).json({ message: 'Lỗi server khi chốt học phí' });
    }
};
exports.markSessionsAsBilled = markSessionsAsBilled;
const syncCalendar = async (req, res) => {
    try {
        const { id } = req.params; // session id
        const teacherId = req.user?.id;
        if (!teacherId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const sessionRes = await db_1.default.query('SELECT * FROM sessions WHERE id = $1', [id]);
        if (sessionRes.rows.length === 0) {
            res.status(404).json({ message: 'Không tìm thấy buổi học' });
            return;
        }
        const session = sessionRes.rows[0];
        const userResult = await db_1.default.query('SELECT google_calendar_tokens FROM users WHERE id = $1', [teacherId]);
        const tokens = userResult.rows[0]?.google_calendar_tokens;
        if (!tokens) {
            res.status(400).json({ message: 'Chưa liên kết Google Calendar' });
            return;
        }
        const parsedTokens = typeof tokens === 'string' ? JSON.parse(tokens) : tokens;
        const userOAuth2Client = new googleapis_1.google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI);
        userOAuth2Client.setCredentials(parsedTokens);
        const calendar = googleapis_1.google.calendar({ version: 'v3', auth: userOAuth2Client });
        // Get emails
        const emailsRes = await db_1.default.query(`SELECT s.email FROM students s
       JOIN enrollments cm ON s.id = cm.student_id
       WHERE cm.class_id = $1 AND cm.status = 'ACTIVE' AND s.is_active = true AND s.email IS NOT NULL`, [session.class_id]);
        const attendees = emailsRes.rows.map(r => ({ email: r.email }));
        if (session.google_event_id) {
            // Update existing event
            await calendar.events.patch({
                calendarId: 'primary',
                eventId: session.google_event_id,
                requestBody: {
                    attendees: attendees
                }
            });
            res.status(200).json({ message: 'Đồng bộ lại lịch Google thành công' });
        }
        else {
            // Create new event
            const event = await calendar.events.insert({
                calendarId: 'primary',
                requestBody: {
                    summary: session.content || 'Lịch học',
                    start: { dateTime: session.session_date + 'T' + (session.start_time || '18:00') + ':00+07:00', timeZone: 'Asia/Ho_Chi_Minh' },
                    end: { dateTime: session.session_date + 'T' + (session.end_time || '19:30') + ':00+07:00', timeZone: 'Asia/Ho_Chi_Minh' },
                    attendees: attendees.length > 0 ? attendees : undefined
                }
            });
            await db_1.default.query('UPDATE sessions SET google_event_id = $1 WHERE id = $2', [event.data.id, session.id]);
            res.status(200).json({ message: 'Tạo mới và đồng bộ lịch Google thành công' });
        }
    }
    catch (error) {
        console.error("Lỗi đồng bộ lại Google Calendar:", error);
        res.status(500).json({ message: 'Lỗi khi đồng bộ Google Calendar' });
    }
};
exports.syncCalendar = syncCalendar;
//# sourceMappingURL=sessionController.js.map