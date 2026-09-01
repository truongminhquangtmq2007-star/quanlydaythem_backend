"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateAttendance = exports.createSession = exports.removeMember = exports.addMember = exports.getSessionAttendance = exports.getClassSessions = exports.getClassMembers = exports.assignTeacher = exports.deleteClass = exports.updateClass = exports.createClass = exports.getClass = exports.getClasses = void 0;
const db_1 = __importDefault(require("../db"));
const googleapis_1 = require("googleapis");
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'dummy_id';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'dummy_secret';
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://quanlydaythem-api.onrender.com/api/calendar/callback';
// 1. Lấy danh sách lớp học (GET)
const getClasses = async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            res.status(401).json({ message: "Không tìm thấy thông tin xác thực!" });
            return;
        }
        let result;
        if (user.role === 'ADMIN') {
            result = await db_1.default.query('SELECT * FROM classes WHERE is_active = TRUE OR is_active IS NULL ORDER BY id DESC');
        }
        else {
            result = await db_1.default.query('SELECT * FROM classes WHERE teacher_id = $1 AND (is_active = TRUE OR is_active IS NULL) ORDER BY id DESC', [user.id]);
        }
        res.status(200).json(result.rows);
    }
    catch (error) {
        console.error("Lỗi khi lấy danh sách lớp học:", error);
        res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
    }
};
exports.getClasses = getClasses;
const getClass = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;
        let result;
        if (user?.role === 'ADMIN') {
            result = await db_1.default.query('SELECT * FROM classes WHERE id = $1', [id]);
        }
        else {
            result = await db_1.default.query('SELECT * FROM classes WHERE id = $1 AND teacher_id = $2', [id, user?.id]);
        }
        if (result.rows.length === 0) {
            res.status(404).json({ message: "Không tìm thấy lớp học hoặc bạn không có quyền truy cập" });
            return;
        }
        const classData = result.rows[0];
        if (user && user.role === 'TEACHER' && classData.teacher_id !== user.id) {
            res.status(403).json({ message: "Bạn không có quyền xem lớp học này." });
            return;
        }
        res.status(200).json(classData);
    }
    catch (error) {
        res.status(500).json({ message: "Lỗi server" });
    }
};
exports.getClass = getClass;
// 2. Thêm lớp học mới (POST) - Cập nhật Schema Lõi
const createClass = async (req, res) => {
    const { class_name, name, description, class_type, meet_link, schedule, tuition_fee } = req.body;
    const finalName = class_name || name;
    const teacherId = req.user?.id;
    if (!finalName) {
        res.status(400).json({ message: 'Tên lớp học là bắt buộc' });
        return;
    }
    try {
        const result = await db_1.default.query('INSERT INTO classes (class_name, description, teacher_id, class_type, meet_link, schedule, tuition_fee) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *', [finalName, description || null, teacherId, class_type || 'OFFLINE', meet_link || null, schedule || null, tuition_fee || null]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error('Lỗi createClass:', error);
        res.status(500).json({ message: 'Lỗi server khi tạo lớp' });
    }
};
exports.createClass = createClass;
const updateClass = async (req, res) => {
    const { id } = req.params;
    const { class_name, description, teacher_id, class_type, meet_link } = req.body;
    try {
        const user = req.user;
        if (user?.role === 'TEACHER') {
            const check = await db_1.default.query('SELECT id FROM classes WHERE id = $1 AND teacher_id = $2', [id, user.id]);
            if (check.rows.length === 0) {
                res.status(403).json({ message: "Bạn không có quyền sửa lớp này" });
                return;
            }
        }
        await db_1.default.query(`UPDATE classes SET class_name = $1, description = $2, teacher_id = $3, class_type = $4, meet_link = $5 WHERE id = $6`, [class_name, description, teacher_id || null, class_type || 'OFFLINE', meet_link || null, id]);
        res.status(200).json({ message: "Cập nhật thành công" });
    }
    catch (error) {
        res.status(500).json({ message: "Lỗi server" });
    }
};
exports.updateClass = updateClass;
// 4. Xóa lớp học (DELETE)
const deleteClass = async (req, res) => {
    const client = await db_1.default.connect();
    try {
        const { id } = req.params;
        const user = req.user;
        if (user?.role === 'TEACHER') {
            const check = await client.query('SELECT id FROM classes WHERE id = $1 AND teacher_id = $2', [id, user.id]);
            if (check.rows.length === 0) {
                res.status(403).json({ message: "Bạn không có quyền xóa lớp này hoặc lớp không tồn tại" });
                return;
            }
        }
        else if (user?.role === 'ADMIN') {
            const check = await client.query('SELECT id FROM classes WHERE id = $1', [id]);
            if (check.rows.length === 0) {
                res.status(404).json({ message: "Không tìm thấy lớp học" });
                return;
            }
        }
        await client.query('BEGIN');
        // Soft delete the class to keep historical data intact
        const result = await client.query('UPDATE classes SET is_active = FALSE WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            res.status(404).json({ message: "Không tìm thấy lớp học" });
            return;
        }
        // Deactivate active enrollments in this class
        await client.query("UPDATE enrollments SET status = 'INACTIVE' WHERE class_id = $1", [id]);
        await client.query('COMMIT');
        res.status(200).json({ message: "Đã xóa lớp học thành công" });
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Lỗi xóa lớp:', error);
        res.status(500).json({ message: "Lỗi máy chủ nội bộ khi xóa lớp học" });
    }
    finally {
        client.release();
    }
};
exports.deleteClass = deleteClass;
// 5. Gán giáo viên cho lớp học
const assignTeacher = async (req, res) => {
    try {
        const user = req.user;
        if (user?.role === 'TEACHER') {
            const checkClassId = req.params.id;
            const check = await db_1.default.query('SELECT id FROM classes WHERE id = $1 AND teacher_id = $2', [checkClassId, user.id]);
            if (check.rows.length === 0) {
                res.status(403).json({ message: "Bạn không có quyền quản lý lớp này" });
                return;
            }
        }
        const classId = req.params.id;
        const { teacher_id } = req.body;
        const result = await db_1.default.query('UPDATE classes SET teacher_id = $1 WHERE id = $2 RETURNING *', [teacher_id, classId]);
        if (result.rows.length === 0) {
            res.status(404).json({ message: 'Không tìm thấy lớp học' });
            return;
        }
        res.status(200).json({ message: 'Đã phân công giáo viên thành công!', class: result.rows[0] });
    }
    catch (error) {
        res.status(500).json({ message: 'Lỗi máy chủ' });
    }
};
exports.assignTeacher = assignTeacher;
// ==========================================
// API MỚI CHO PHASE 1 - CORE
// ==========================================
const getClassMembers = async (req, res) => {
    try {
        const user = req.user;
        if (user?.role === 'TEACHER') {
            const checkClassId = req.params.id;
            const check = await db_1.default.query('SELECT id FROM classes WHERE id = $1 AND teacher_id = $2', [checkClassId, user.id]);
            if (check.rows.length === 0) {
                res.status(403).json({ message: "Bạn không có quyền quản lý lớp này" });
                return;
            }
        }
        const { id } = req.params;
        const result = await db_1.default.query('SELECT s.id, s.full_name, s.phone_number AS phone FROM students s JOIN enrollments cm ON s.id = cm.student_id WHERE cm.class_id = $1 ORDER BY s.full_name', [id]);
        res.status(200).json(result.rows);
    }
    catch (error) {
        console.error("Lỗi get class members:", error);
        res.status(500).json({ error: "Lỗi khi lấy danh sách học sinh" });
    }
};
exports.getClassMembers = getClassMembers;
const getClassSessions = async (req, res) => {
    try {
        const user = req.user;
        if (user?.role === 'TEACHER') {
            const checkClassId = req.params.id;
            const check = await db_1.default.query('SELECT id FROM classes WHERE id = $1 AND teacher_id = $2', [checkClassId, user.id]);
            if (check.rows.length === 0) {
                res.status(403).json({ message: "Bạn không có quyền quản lý lớp này" });
                return;
            }
        }
        const { id } = req.params;
        const result = await db_1.default.query(`SELECT * FROM sessions WHERE class_id = $1 ORDER BY session_date DESC`, [id]);
        console.log(`[getClassSessions] class_id=${id}, result length=${result.rows.length}`);
        res.json(result.rows);
    }
    catch (err) {
        res.status(500).json({ message: "Lỗi server" });
    }
};
exports.getClassSessions = getClassSessions;
const getSessionAttendance = async (req, res) => {
    try {
        const { id } = req.params; // session_id
        const user = req.user;
        // Check ownership
        if (user?.role === 'TEACHER') {
            const check = await db_1.default.query('SELECT c.id FROM sessions s JOIN classes c ON s.class_id = c.id WHERE s.id = $1 AND c.teacher_id = $2', [id, user.id]);
            if (check.rows.length === 0) {
                res.status(403).json({ message: "Bạn không có quyền truy cập điểm danh này" });
                return;
            }
        }
        const sessionRes = await db_1.default.query('SELECT class_id, session_date FROM sessions WHERE id = $1', [id]);
        if (sessionRes.rows.length === 0) {
            res.status(404).json({ message: "Không tìm thấy buổi học" });
            return;
        }
        const { class_id, session_date } = sessionRes.rows[0];
        // 2. Query all enrolled students, left join attendance
        const result = await db_1.default.query(`SELECT e.student_id, s.full_name, s.id as student_code, a.id as attendance_id, a.status, a.notes, a.absent_reason
       FROM enrollments e
       JOIN students s ON e.student_id = s.id
       LEFT JOIN attendance a ON a.student_id = e.student_id AND a.class_id = $1 AND a.attendance_date = $2
       WHERE e.class_id = $1 AND (e.status IS NULL OR e.status = 'ACTIVE' OR e.status = 'Đang học' OR e.status NOT IN ('Đã nghỉ', 'Bảo lưu', 'INACTIVE'))
       ORDER BY s.full_name`, [class_id, session_date]);
        res.json(result.rows);
    }
    catch (err) {
        res.status(500).json({ message: "Lỗi server" });
    }
};
exports.getSessionAttendance = getSessionAttendance;
// POST /api/classes/:id/members
const addMember = async (req, res) => {
    const { id } = req.params; // class_id
    const { student_id } = req.body;
    try {
        const user = req.user;
        if (user?.role === 'TEACHER') {
            const checkClassId = req.params.id;
            const check = await db_1.default.query('SELECT id FROM classes WHERE id = $1 AND teacher_id = $2', [checkClassId, user.id]);
            if (check.rows.length === 0) {
                res.status(403).json({ message: "Bạn không có quyền quản lý lớp này" });
                return;
            }
        }
        const checkExist = await db_1.default.query('SELECT id, status FROM enrollments WHERE class_id = $1 AND student_id = $2', [id, student_id]);
        if (checkExist.rows.length > 0) {
            const currentStatus = checkExist.rows[0].status;
            if (currentStatus === 'Đang học' || currentStatus === 'ACTIVE' || !currentStatus) {
                res.status(400).json({ message: "Học sinh đã có trong lớp này" });
                return;
            }
            else {
                const updated = await db_1.default.query("UPDATE enrollments SET status = 'Đang học', enrollment_date = NOW() WHERE id = $1 RETURNING *", [checkExist.rows[0].id]);
                res.status(200).json({ message: "Đã thêm lại học sinh vào lớp", member: updated.rows[0] });
                return;
            }
        }
        const result = await db_1.default.query(`INSERT INTO enrollments (class_id, student_id, status, enrollment_date) VALUES ($1, $2, 'Đang học', NOW()) RETURNING *`, [id, student_id]);
        res.status(201).json({ message: "Đã thêm học sinh vào lớp", member: result.rows[0] });
    }
    catch (error) {
        if (error.code === '23505') { // Unique violation
            res.status(400).json({ message: "Học sinh đã có trong lớp này" });
            return;
        }
        console.error(error);
        res.status(500).json({ message: "Lỗi server khi thêm học sinh" });
    }
};
exports.addMember = addMember;
// DELETE /api/classes/:id/members/:studentId
const removeMember = async (req, res) => {
    const { id, studentId } = req.params; // class_id, student_id
    try {
        const user = req.user;
        if (user?.role === 'TEACHER') {
            const check = await db_1.default.query('SELECT id FROM classes WHERE id = $1 AND teacher_id = $2', [id, user.id]);
            if (check.rows.length === 0) {
                res.status(403).json({ message: "Bạn không có quyền quản lý lớp này hoặc lớp không tồn tại" });
                return;
            }
        }
        else if (user?.role === 'ADMIN') {
            const check = await db_1.default.query('SELECT id FROM classes WHERE id = $1', [id]);
            if (check.rows.length === 0) {
                res.status(404).json({ message: "Không tìm thấy lớp học" });
                return;
            }
        }
        const checkEnroll = await db_1.default.query('SELECT id FROM enrollments WHERE class_id = $1 AND student_id = $2', [id, studentId]);
        if (checkEnroll.rows.length === 0) {
            res.status(404).json({ message: "Học sinh không có trong lớp học này" });
            return;
        }
        // Delete enrollment record for this class (DO NOT delete the student account or other class enrollments)
        await db_1.default.query('DELETE FROM enrollments WHERE class_id = $1 AND student_id = $2', [id, studentId]);
        res.status(200).json({ message: "Đã xóa học sinh khỏi lớp thành công" });
    }
    catch (error) {
        console.error("Lỗi xóa học sinh khỏi lớp:", error);
        res.status(500).json({ message: "Lỗi server khi xóa học sinh khỏi lớp" });
    }
};
exports.removeMember = removeMember;
// POST /api/classes/:id/sessions
const createSession = async (req, res) => {
    const { id } = req.params; // class_id
    const { session_date, start_time, end_time, content, homework } = req.body;
    if (!session_date) {
        res.status(400).json({ message: "Vui lòng chọn ngày học" });
        return;
    }
    const client = await db_1.default.connect();
    try {
        const user = req.user;
        if (user?.role === 'TEACHER') {
            const check = await db_1.default.query('SELECT id FROM classes WHERE id = $1 AND teacher_id = $2', [id, user.id]);
            if (check.rows.length === 0) {
                res.status(403).json({ message: "Bạn không có quyền quản lý lớp này hoặc lớp không tồn tại" });
                return;
            }
        }
        else if (user?.role === 'ADMIN') {
            const check = await db_1.default.query('SELECT id FROM classes WHERE id = $1', [id]);
            if (check.rows.length === 0) {
                res.status(404).json({ message: "Lớp học không tồn tại" });
                return;
            }
        }
        await client.query('BEGIN');
        // 1. Tạo buổi học
        const sessionRes = await client.query(`INSERT INTO sessions (class_id, session_date, start_time, content, homework, is_published) 
       VALUES ($1, $2, $3, $4, $5, false) RETURNING *`, [id, session_date, start_time || '18:00', content || null, homework || null]);
        const session = sessionRes.rows[0];
        // Google Calendar Sync (optional, non-blocking)
        try {
            const teacherId = req.user?.id;
            if (teacherId) {
                const userResult = await client.query('SELECT google_calendar_tokens FROM users WHERE id = $1', [teacherId]);
                const tokens = userResult.rows[0]?.google_calendar_tokens;
                if (tokens) {
                    const parsedTokens = typeof tokens === 'string' ? JSON.parse(tokens) : tokens;
                    const userOAuth2Client = new googleapis_1.google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI);
                    userOAuth2Client.setCredentials(parsedTokens);
                    const calendar = googleapis_1.google.calendar({ version: 'v3', auth: userOAuth2Client });
                    // Get students emails
                    const emailsRes = await client.query(`SELECT s.email FROM students s
             JOIN enrollments cm ON s.id = cm.student_id
             WHERE cm.class_id = $1 AND cm.status = 'ACTIVE' AND s.is_active = true AND s.email IS NOT NULL`, [id]);
                    const attendees = emailsRes.rows.map(r => ({ email: r.email }));
                    const dateStr = session_date.includes('T') ? session_date.split('T')[0] : session_date;
                    const startClean = (start_time || '18:00').substring(0, 5) + ':00';
                    const endClean = (end_time || '19:30').substring(0, 5) + ':00';
                    const event = await calendar.events.insert({
                        calendarId: 'primary',
                        requestBody: {
                            summary: content || 'Lịch học',
                            start: { dateTime: `${dateStr}T${startClean}+07:00`, timeZone: 'Asia/Ho_Chi_Minh' },
                            end: { dateTime: `${dateStr}T${endClean}+07:00`, timeZone: 'Asia/Ho_Chi_Minh' },
                            attendees: attendees.length > 0 ? attendees : undefined
                        }
                    });
                    if (event.data?.id) {
                        await client.query('UPDATE sessions SET google_event_id = $1 WHERE id = $2', [event.data.id, session.id]);
                        session.google_event_id = event.data.id;
                    }
                }
            }
        }
        catch (googleErr) {
            console.error("Lỗi đồng bộ Google Calendar khi tạo buổi học:", googleErr);
        }
        await client.query('COMMIT');
        res.status(201).json({
            message: "Tạo buổi học thành công",
            session
        });
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Lỗi tạo buổi học:', error);
        res.status(500).json({
            message: "Lỗi server khi tạo buổi học"
        });
    }
    finally {
        client.release();
    }
};
exports.createSession = createSession;
// PUT /api/sessions/:id/attendance (Được định tuyến qua classRoutes hoặc sessionRoutes)
const updateAttendance = async (req, res) => {
    const { id } = req.params; // session_id
    const { student_id, status, note, absent_reason } = req.body;
    try {
        const user = req.user;
        // Check ownership
        if (user?.role === 'TEACHER') {
            const check = await db_1.default.query('SELECT c.id FROM sessions s JOIN classes c ON s.class_id = c.id WHERE s.id = $1 AND c.teacher_id = $2', [id, user.id]);
            if (check.rows.length === 0) {
                res.status(403).json({ message: "Bạn không có quyền điểm danh lớp này" });
                return;
            }
        }
        const sessionRes = await db_1.default.query('SELECT class_id, session_date FROM sessions WHERE id = $1', [id]);
        if (sessionRes.rows.length === 0) {
            res.status(404).json({ message: "Không tìm thấy buổi học" });
            return;
        }
        const { class_id, session_date } = sessionRes.rows[0];
        // 2. Upsert điểm danh do không có session_id
        const checkRes = await db_1.default.query('SELECT id FROM attendance WHERE class_id = $1 AND attendance_date = $2 AND student_id = $3', [class_id, session_date, student_id]);
        let result;
        if (checkRes.rows.length > 0) {
            result = await db_1.default.query(`UPDATE attendance SET status = $1, notes = $2 
         WHERE class_id = $3 AND attendance_date = $4 AND student_id = $5 RETURNING *`, [status, note, class_id, session_date, student_id]);
        }
        else {
            result = await db_1.default.query(`INSERT INTO attendance (class_id, attendance_date, student_id, status, notes) 
         VALUES ($1, $2, $3, $4, $5) RETURNING *`, [class_id, session_date, student_id, status, note]);
        }
        res.status(200).json({ message: "Cập nhật điểm danh thành công", attendance: result.rows[0] });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Lỗi server khi cập nhật điểm danh" });
    }
};
exports.updateAttendance = updateAttendance;
//# sourceMappingURL=classController.js.map