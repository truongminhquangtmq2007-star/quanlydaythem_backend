"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveCanonicalStudentId = exports.UNLINKED_STUDENT_MESSAGE = void 0;
const db_1 = __importDefault(require("../db"));
exports.UNLINKED_STUDENT_MESSAGE = 'Tài khoản chưa được liên kết với hồ sơ học sinh. Vui lòng liên hệ giáo viên để được hỗ trợ.';
/**
 * Resolves the canonical `students.id` for an authenticated STUDENT user.
 * Never falls back to `users.id` and rejects mismatched or unlinked student claims.
 */
const resolveCanonicalStudentId = async (user, dbPool = db_1.default) => {
    if (!user || String(user.role || '').toUpperCase() !== 'STUDENT') {
        return null;
    }
    const userId = Number(user.id);
    if (!Number.isInteger(userId) || userId <= 0) {
        return null;
    }
    const uRes = await dbPool.query(`SELECT id, student_id FROM users WHERE id = $1 AND role = 'STUDENT'`, [userId]);
    if (uRes.rows.length === 0) {
        return null;
    }
    const linkedStudentId = uRes.rows[0].student_id;
    if (linkedStudentId === null ||
        linkedStudentId === undefined ||
        !Number.isInteger(Number(linkedStudentId)) ||
        Number(linkedStudentId) <= 0) {
        return null;
    }
    if (user.student_id !== undefined && user.student_id !== null) {
        if (Number(user.student_id) !== Number(linkedStudentId)) {
            return null;
        }
    }
    const sRes = await dbPool.query(`SELECT id FROM students WHERE id = $1`, [Number(linkedStudentId)]);
    if (sRes.rows.length === 0) {
        return null;
    }
    return Number(sRes.rows[0].id);
};
exports.resolveCanonicalStudentId = resolveCanonicalStudentId;
//# sourceMappingURL=studentIdentity.js.map