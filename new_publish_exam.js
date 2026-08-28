"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishExam = void 0;
const publishExam = async (req, res) => {
    try {
        let { document_id, title, grade, subject, duration_minutes, class_id, exam_content } = req.body;
        let folderId = null;
        if (class_id) {
            const folderCheck = await pool.query("SELECT id FROM folders WHERE class_id = $1 AND category = 'EXAM'", [class_id]);
            if (folderCheck.rows.length > 0) {
                folderId = folderCheck.rows[0].id;
            }
        }
        // 1. Tạo hoặc cập nhật Document
        let actual_document_id = document_id;
        if (!document_id || document_id === 0) {
            const docRes = await pool.query(`INSERT INTO documents (title, category, folder_id, duration_minutes, teacher_id) 
                 VALUES ($1, 'EXAM', $2, $3, $4) RETURNING id`, [title || 'Đề thi AI', folderId, duration_minutes, req.user?.id || null]);
            actual_document_id = docRes.rows[0].id;
        }
        else {
            await pool.query(`UPDATE documents SET title = $1, folder_id = $2, duration_minutes = $3 WHERE id = $4`, [title, folderId, duration_minutes, actual_document_id]);
        }
        if (exam_content) {
            // 2. Lưu vào bảng exam_keys (để hiện thị lại khi vào xem)
            const part1_key = exam_content.part1?.reduce((acc, q) => { acc[q.id] = q.correctAnswer; return acc; }, {}) || {};
            const part2_key = exam_content.part2?.reduce((acc, q) => { acc[q.id] = q.correctAnswer; return acc; }, {}) || {};
            const part3_key = exam_content.part3?.reduce((acc, q) => { acc[q.id] = q.correctAnswer; return acc; }, {}) || {};
            await pool.query(`INSERT INTO exam_keys (document_id, class_id, part1_key, part2_key, part3_key, allow_view_answers, duration_minutes, exam_content) 
                 VALUES ($1, $2, $3, $4, $5, true, $6, $7) 
                 ON CONFLICT (document_id) 
                 DO UPDATE SET 
                    part1_key = $3, part2_key = $4, part3_key = $5,
                    duration_minutes = $6, exam_content = $7`, [actual_document_id, class_id, part1_key, part2_key, part3_key, duration_minutes, exam_content]);
            // 3. Xóa các câu hỏi cũ (nếu có)
            await pool.query(`DELETE FROM questions WHERE quiz_id = $1`, [actual_document_id]);
            // 4. Cập nhật lại bảng questions thực tế
            const allQuestions = [
                ...(exam_content.part1 || []).map((q) => ({ ...q, part_number: 1, question_type: 'MCQ' })),
                ...(exam_content.part2 || []).map((q) => ({ ...q, part_number: 2, question_type: 'TRUE_FALSE' })),
                ...(exam_content.part3 || []).map((q) => ({ ...q, part_number: 3, question_type: 'SHORT_ANSWER' }))
            ];
            if (allQuestions.length > 0) {
                await Promise.all(allQuestions.map(q => pool.query(`INSERT INTO questions (quiz_id, part_number, question_type, content, answer_data) VALUES ($1, $2, $3, $4, $5)`, [actual_document_id, q.part_number, q.question_type, JSON.stringify(q), JSON.stringify(q.correctAnswer)])));
            }
        }
        res.status(200).json({ message: 'Xuất bản đề thi thành công!', document_id: actual_document_id });
    }
    catch (error) {
        console.error('Lỗi publish đề:', error);
        res.status(500).json({ message: 'Lỗi xuất bản đề thi' });
    }
};
exports.publishExam = publishExam;
//# sourceMappingURL=new_publish_exam.js.map