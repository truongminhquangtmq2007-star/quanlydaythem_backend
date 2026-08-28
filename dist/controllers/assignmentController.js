"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClassAssignments = exports.createAssignment = void 0;
const db_1 = __importDefault(require("../db"));
// POST /api/assignments
const createAssignment = async (req, res) => {
    try {
        const { title, class_id, document_id, due_at } = req.body;
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
        // Ẩn tính năng Bài tập do lỗi schema, luôn trả về mảng rỗng
        res.status(200).json([]);
    }
    catch (error) {
        res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
    }
};
exports.getClassAssignments = getClassAssignments;
//# sourceMappingURL=assignmentController.js.map