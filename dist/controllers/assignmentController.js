"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAssignment = exports.getClassAssignments = exports.createAssignment = void 0;
const db_1 = __importDefault(require("../db"));
// POST /api/assignments
const createAssignment = async (req, res) => {
    try {
        const { title, class_id, document_id, due_at } = req.body;
        const user = req.user;
        if (user?.role === 'TEACHER') {
            const check = await db_1.default.query('SELECT id FROM classes WHERE id = $1 AND teacher_id = $2', [class_id, user.id]);
            if (check.rows.length === 0) {
                res.status(403).json({ message: "Không có quyền giao bài cho lớp này" });
                return;
            }
        }
        const result = await db_1.default.query(`INSERT INTO assignments (title, class_id, document_id, due_at) 
       VALUES ($1, $2, $3, $4) RETURNING *`, [title, class_id, document_id, due_at]);
        res.status(201).json({
            message: 'Giao bài tập thành công',
            assignment: result.rows[0]
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi server khi giao bài tập' });
    }
};
exports.createAssignment = createAssignment;
// GET /api/classes/:id/assignments
const getClassAssignments = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;
        if (user?.role === 'TEACHER') {
            const check = await db_1.default.query('SELECT id FROM classes WHERE id = $1 AND teacher_id = $2', [id, user.id]);
            if (check.rows.length === 0) {
                res.status(403).json({ message: "Không có quyền xem bài tập của lớp này" });
                return;
            }
        }
        const result = await db_1.default.query(`SELECT a.id, a.class_id, a.document_id, COALESCE(a.title, d.title, 'Tài liệu') as title, 
              d.title as doc_title, d.file_url, d.category, a.due_at, a.description as session_info, 
              a.created_at, f.name as folder_name 
       FROM assignments a
       LEFT JOIN documents d ON a.document_id = d.id
       LEFT JOIN folders f ON d.folder_id = f.id
       WHERE a.class_id = $1
       ORDER BY a.created_at DESC`, [id]);
        res.status(200).json(result.rows);
    }
    catch (error) {
        console.error('Error fetching assignments:', error);
        res.status(500).json({ message: "Lỗi server khi tải danh sách bài tập" });
    }
};
exports.getClassAssignments = getClassAssignments;
// DELETE /api/assignments/:id or /api/classes/:id/assignments/:assignmentId
const deleteAssignment = async (req, res) => {
    try {
        const { id, assignmentId } = req.params;
        const targetId = assignmentId || id;
        const user = req.user;
        if (user?.role === 'TEACHER') {
            const check = await db_1.default.query('SELECT a.id FROM assignments a JOIN classes c ON a.class_id = c.id WHERE a.id = $1 AND c.teacher_id = $2', [targetId, user.id]);
            if (check.rows.length === 0) {
                res.status(403).json({ message: "Bạn không có quyền xóa bài tập này hoặc bài tập không tồn tại" });
                return;
            }
        }
        await db_1.default.query('DELETE FROM assignments WHERE id = $1', [targetId]);
        res.status(200).json({ message: 'Đã xóa bài tập được giao thành công' });
    }
    catch (error) {
        console.error('Error deleting assignment:', error);
        res.status(500).json({ message: "Lỗi server khi xóa bài tập" });
    }
};
exports.deleteAssignment = deleteAssignment;
//# sourceMappingURL=assignmentController.js.map