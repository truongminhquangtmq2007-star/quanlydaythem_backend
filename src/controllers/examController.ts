import { v2 as cloudinary } from 'cloudinary';
import { generateWithFallback } from '../services/geminiService';
import { Response } from 'express';
import pool from '../db';
import { AuthRequest } from '../middleware/authMiddleware';
// 👇 Nhập hàm gọi Gemini từ service bạn vừa tạo
import {
    parseFullExamWithGemini,
    parseFullExamFromFileWithGemini,
    normalizeExamData
} from '../services/geminiService';
// ========================================================
// 1. API GIÁO VIÊN: LƯU ĐÁP ÁN CHUẨN VÀ NỘI DUNG ĐỀ VÀO DATABASE
// ========================================================
export const saveAnswerKey = async (req: AuthRequest, res: Response): Promise<void> => {
    const client = await pool.connect();
    try {
        const { document_id, class_id, part1_key, part2_key, part3_key, allow_view_answers, duration_minutes, exam_content } = req.body;
        
        const documentCheck = await client.query('SELECT id, teacher_id FROM documents WHERE id = $1', [document_id]);
        if (documentCheck.rows.length === 0) {
            client.release();
            res.status(400).json({
                message: `Tài liệu có ID ${document_id} không tồn tại`
            });
            return;
        }

        await client.query('BEGIN');
        
        let folderId: number | null = null;
        if (class_id) {
            const folderCheck = await client.query("SELECT id FROM folders WHERE class_id = $1 AND category = 'EXAM'", [class_id]);
            if (folderCheck.rows.length > 0) {
                folderId = folderCheck.rows[0].id;
            } else {
                const newFolder = await client.query(
                    "INSERT INTO folders (name, category, class_id, teacher_id) VALUES ('Đề thi', 'EXAM', $1, $2) RETURNING id",
                    [class_id, req.user?.id || null]
                );
                folderId = newFolder.rows[0].id;
            }
            await client.query(
                `UPDATE documents SET folder_id = $1, class_id = $2, category = 'EXAM' WHERE id = $3`, 
                [folderId, class_id, document_id]
            );
        } else {
            await client.query(
                `UPDATE documents SET category = 'EXAM' WHERE id = $1`, 
                [document_id]
            );
        }

        let primaryContextId: number | null = null;
        let finalExamContent = exam_content;

        // XỬ LÝ CÂU HỎI CHÙM (SHARED CONTEXT)
        const rawShared = exam_content?.shared_context || exam_content?.sharedContexts || req.body.shared_context;
        const sharedList = Array.isArray(rawShared) ? rawShared : rawShared ? [rawShared] : [];

        if (sharedList.length > 0) {
            let ctxCounter = 1;
            for (const item of sharedList) {
                const content = item.content || item.text || (typeof item === 'string' ? item : '');
                const imageUrl = item.image_url || null;
                const questionIds = Array.isArray(item.questionIds) ? item.questionIds : (Array.isArray(item.question_ids) ? item.question_ids : []);
                
                // Xác định part chính xác: Không tự ý default part1 nếu questionIds thuộc part2 hoặc part3
                let part = item.part;
                if (!part || (part !== 'part1' && part !== 'part2' && part !== 'part3')) {
                    if (item.part_number === 2) part = 'part2';
                    else if (item.part_number === 3) part = 'part3';
                    else if (item.part_number === 1) part = 'part1';
                    else {
                        const subQs = Array.isArray(item.questions) ? item.questions : [];
                        const isSubP2 = subQs.some((sq: any) => sq.question_type === 'TRUE_FALSE' || sq.statements || sq.part === 'part2' || sq.part_number === 2);
                        const isSubP3 = subQs.some((sq: any) => sq.question_type === 'SHORT_ANSWER' || sq.part === 'part3' || sq.part_number === 3);
                        const isSubP1 = subQs.some((sq: any) => sq.question_type === 'MCQ' || sq.options || sq.part === 'part1' || sq.part_number === 1);
                        if (isSubP2 && !isSubP1 && !isSubP3) part = 'part2';
                        else if (isSubP3 && !isSubP1 && !isSubP2) part = 'part3';
                        else if (isSubP1 && !isSubP2 && !isSubP3) part = 'part1';
                        else {
                            const inP2Ctx = (finalExamContent?.part2 || []).some((q: any) => q.context_id && (q.context_id === item.id || q.context_id === item.context_id));
                            const inP3Ctx = (finalExamContent?.part3 || []).some((q: any) => q.context_id && (q.context_id === item.id || q.context_id === item.context_id));
                            const inP1Ctx = (finalExamContent?.part1 || []).some((q: any) => q.context_id && (q.context_id === item.id || q.context_id === item.context_id));
                            if (inP2Ctx && !inP1Ctx && !inP3Ctx) part = 'part2';
                            else if (inP3Ctx && !inP1Ctx && !inP2Ctx) part = 'part3';
                            else if (inP1Ctx && !inP2Ctx && !inP3Ctx) part = 'part1';
                            else {
                                const inP2 = (finalExamContent?.part2 || []).some((q: any) => questionIds.some((qid: any) => String(qid) === String(q.id)));
                                const inP3 = (finalExamContent?.part3 || []).some((q: any) => questionIds.some((qid: any) => String(qid) === String(q.id)));
                                const inP1 = (finalExamContent?.part1 || []).some((q: any) => questionIds.some((qid: any) => String(qid) === String(q.id)));
                                if (inP2 && !inP1 && !inP3) part = 'part2';
                                else if (inP3 && !inP1 && !inP2) part = 'part3';
                                else if (inP1 && !inP2 && !inP3) part = 'part1';
                                else {
                                    const p2HasQ = (finalExamContent?.part2 || []).some((q: any) => questionIds.some((qid: any) => String(qid) === String(q.id)) && !q.context_id);
                                    const p3HasQ = (finalExamContent?.part3 || []).some((q: any) => questionIds.some((qid: any) => String(qid) === String(q.id)) && !q.context_id);
                                    const p1HasQ = (finalExamContent?.part1 || []).some((q: any) => questionIds.some((qid: any) => String(qid) === String(q.id)) && !q.context_id);
                                    if (p2HasQ && !p1HasQ && !p3HasQ) part = 'part2';
                                    else if (p3HasQ && !p1HasQ && !p2HasQ) part = 'part3';
                                    else if (p1HasQ && !p2HasQ && !p3HasQ) part = 'part1';
                                    else part = 'part1';
                                }
                            }
                        }
                    }
                }

                const contextId = item.id || item.context_id || ctxCounter++;
                if (!primaryContextId && contextId) {
                    primaryContextId = contextId;
                }

                item.id = contextId;
                item.context_id = contextId;
                item.part = part;
                item.content = content;
                item.image_url = imageUrl;
                item.questionIds = questionIds;

                if (finalExamContent) {
                    const targetParts = (part === 'part1' || part === 'part2' || part === 'part3') ? [part] : ['part1', 'part2', 'part3'];
                    targetParts.forEach(pKey => {
                        (finalExamContent[pKey] || []).forEach((q: any) => {
                            if (questionIds.some((qid: any) => String(qid) === String(q.id))) {
                                q.context_id = contextId;
                            }
                        });
                    });
                }
            }

            if (finalExamContent) {
                finalExamContent.shared_context = sharedList;
                finalExamContent.sharedContexts = sharedList;
            }
        }

        const currentData = await client.query(
            `SELECT 
                part1_key,
                part2_key,
                part3_key,
                exam_content,
                allow_view_answers,
                duration_minutes
             FROM exam_keys
             WHERE document_id = $1`,
            [document_id]
        );
        const old = currentData.rows[0] || {
            part1_key: {},
            part2_key: {},
            part3_key: {},
            exam_content: null
        };

        const resolvedExamContent =
            finalExamContent !== undefined
                ? finalExamContent
                : old.exam_content;

        const p1 = part1_key && Object.keys(part1_key).length > 0 ? part1_key : old.part1_key;
        const p2 = part2_key && Object.keys(part2_key).length > 0 ? part2_key : old.part2_key;
        const p3 = part3_key && Object.keys(part3_key).length > 0 ? part3_key : old.part3_key;

        // Lưu vào bảng exam_keys kèm context_id tương ứng
        await client.query(
            `INSERT INTO exam_keys (document_id, class_id, part1_key, part2_key, part3_key, allow_view_answers, duration_minutes, exam_content) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
             ON CONFLICT (document_id) 
             DO UPDATE SET 
                class_id = COALESCE($2, exam_keys.class_id),
                part1_key = $3, part2_key = $4, part3_key = $5,
                allow_view_answers = $6, duration_minutes = $7, exam_content = $8
             RETURNING *`,
            [
                document_id,
                class_id,
                p1,
                p2,
                p3,
                allow_view_answers !== undefined ? allow_view_answers : true,
                duration_minutes || 50,
                resolvedExamContent
            ]
        );

        // ĐỒNG BỘ VÀO BẢNG questions
        if (resolvedExamContent) {
            await client.query(`DELETE FROM questions WHERE quiz_id = $1`, [document_id]);
            const allQuestions = [
                ...(resolvedExamContent.part1 || []).map((q: any) => ({ ...q, part_number: 1, question_type: 'MCQ' })),
                ...(resolvedExamContent.part2 || []).map((q: any) => ({ ...q, part_number: 2, question_type: 'TRUE_FALSE' })),
                ...(resolvedExamContent.part3 || []).map((q: any) => ({ ...q, part_number: 3, question_type: 'SHORT_ANSWER' }))
            ];
            
            for (const q of allQuestions) {
                await client.query(
                    `INSERT INTO questions (quiz_id, part_number, question_type, content, answer_data) 
                     VALUES ($1, $2, $3, $4, $5)`,
                    [document_id, q.part_number, q.question_type, JSON.stringify(q), JSON.stringify(q.correctAnswer)]
                );
            }
        }

        await client.query('COMMIT');
        client.release();

        res.status(200).json({ 
            success: true,
            message: 'Lưu đề thi và đáp án thành công!',
            document_id,
            context_id: primaryContextId
        });
    } catch (error) {
        await client.query('ROLLBACK');
        client.release();
        console.error('LỖI LƯU ĐÁP ÁN VÀ NỘI DUNG ĐỀ:', error);
        res.status(500).json({ message: 'Lỗi server khi lưu đáp án', detail: (error as Error).message });
    }
};

const normalizeShortAnswer = (value: any): string => {
    return String(value ?? '')
        .trim()
        .replace(/\s+/g, '')
        .replace(',', '.');
};

const normalizeTrueFalse = (val: any): string => {
    if (val === null || val === undefined) return '';
    const s = String(val).trim().toUpperCase();
    if (s === 'Đ' || s === 'D' || s === 'ĐÚNG' || s === 'DUNG' || s === 'TRUE' || s === 'T' || s === '1') return 'Đ';
    if (s === 'S' || s === 'SAI' || s === 'FALSE' || s === 'F' || s === '0') return 'S';
    return s;
};

// ========================================================
// 1B. API HỌC SINH: LƯU NHÁP VÀ KHÔI PHỤC (AUTO-SAVE)
// ========================================================
export const getDraftExam = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const studentId = req.user?.student_id || req.user?.id;
        const examId = req.params.id;
        const result = await pool.query(
            `SELECT student_answers, last_saved_at, time_taken_seconds FROM exam_submissions 
             WHERE student_id = $1 AND document_id = $2 AND status = 'IN_PROGRESS'`,
            [studentId, examId]
        );

        if (result.rows.length > 0) {
            res.status(200).json({ draft: result.rows[0] });
        } else {
            res.status(200).json({ draft: null });
        }
    } catch (error) {
        console.error('Lỗi lấy bản nháp:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

export const saveDraftExam = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const studentId = req.user?.student_id || req.user?.id;
        const examId = req.params.id;
        const { answers, student_answers, time_taken_seconds } = req.body;
        const draftAnswers = answers !== undefined ? answers : (student_answers !== undefined ? student_answers : {});
        const exist = await pool.query(
            `SELECT id FROM exam_submissions WHERE student_id = $1 AND document_id = $2 AND status = 'IN_PROGRESS'`,
            [studentId, examId]
        );

        if (exist.rows.length > 0) {
            await pool.query(
                `UPDATE exam_submissions SET student_answers = $1, time_taken_seconds = $2, last_saved_at = NOW() WHERE id = $3`,
                [JSON.stringify(draftAnswers), time_taken_seconds || 0, exist.rows[0].id]
            );
        } else {
            await pool.query(
                `INSERT INTO exam_submissions (document_id, student_id, student_answers, total_score, part1_score, part2_score, part3_score, submitted_at, time_taken_seconds, status, last_saved_at) VALUES ($1, $2, $3, 0, 0, 0, 0, NULL, $4, 'IN_PROGRESS', NOW())`,
                [examId, studentId, JSON.stringify(draftAnswers), time_taken_seconds || 0]
            );
        }
        res.status(200).json({ message: 'Đã lưu nháp' });
    } catch (error) {
        console.error('Lỗi lưu bản nháp:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// ========================================================
// 2. API HỌC SINH: NỘP BÀI VÀ CHẤM ĐIỂM TỰ ĐỘNG (AUTO-GRADING)
// ========================================================
export const submitExam = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const studentId = req.user?.student_id || req.user?.id;
        const examId = req.params.id || req.body.document_id || req.body.exam_id;
        const { student_answers, answers, cheat_count, time_taken_seconds } = req.body;

        if (!examId) {
            res.status(400).json({ message: 'Thiếu mã đề thi (document_id / exam_id)!' });
            return;
        }

        // Tự động tạo bảng exam_submissions nếu chưa tồn tại
        

        // Đảm bảo các cột mới luôn tồn tại
        

        const keyResult = await pool.query(`SELECT * FROM exam_keys WHERE document_id = $1`, [examId]);
        if (keyResult.rows.length === 0) {
            res.status(404).json({ message: 'Đề thi này chưa được giáo viên thiết lập đáp án!' });
            return;
        }
        
        const answerKey = keyResult.rows[0];
        const examContent = answerKey.exam_content || {};

        // 1. Tải toàn bộ câu hỏi của đề thi này từ bảng questions (server-side truth)
        const dbQuestionsRes = await pool.query(
            `SELECT id, quiz_id, part_number, question_type, content, answer_data 
             FROM questions 
             WHERE quiz_id = $1`,
            [examId]
        );
        const dbQuestions = dbQuestionsRes.rows;

        // Xây dựng lookup map từ cơ sở dữ liệu
        const dbQuestionById = new Map<number, any>();
        const dbToLocalMap: { [key: number]: number } = {};
        const localToDbP1: { [key: string]: number } = {};
        const localToDbP2: { [key: string]: number } = {};
        const localToDbP3: { [key: string]: number } = {};

        for (const row of dbQuestions) {
            const dbId = Number(row.id);
            dbQuestionById.set(dbId, row);
            let localId: number | null = null;
            try {
                const c = typeof row.content === 'string' ? JSON.parse(row.content) : row.content;
                if (c && c.id !== undefined && !isNaN(Number(c.id))) {
                    localId = Number(c.id);
                }
            } catch { localId = null; }

            if (localId !== null) {
                dbToLocalMap[dbId] = localId;
                if (row.part_number === 1) localToDbP1[String(localId)] = dbId;
                else if (row.part_number === 2) localToDbP2[String(localId)] = dbId;
                else if (row.part_number === 3) localToDbP3[String(localId)] = dbId;
            }
        }

        // Tạo tập hợp câu hỏi hợp lệ của từng phần cho đề thi này
        const validP1QuestionIds = new Set<string>();
        const validP2QuestionIds = new Set<string>();
        const validP3QuestionIds = new Set<string>();

        (examContent.part1 || []).forEach((q: any) => { if (q.id !== undefined) validP1QuestionIds.add(String(q.id)); });
        (examContent.part2 || []).forEach((q: any) => { if (q.id !== undefined) validP2QuestionIds.add(String(q.id)); });
        (examContent.part3 || []).forEach((q: any) => { if (q.id !== undefined) validP3QuestionIds.add(String(q.id)); });

        const rawPart1Key = answerKey.part1_key || {};
        const rawPart2Key = answerKey.part2_key || {};
        const rawPart3Key = answerKey.part3_key || {};

        Object.keys(rawPart1Key).forEach(k => validP1QuestionIds.add(String(k)));
        Object.keys(rawPart2Key).forEach(k => validP2QuestionIds.add(String(k)));
        Object.keys(rawPart3Key).forEach(k => validP3QuestionIds.add(String(k)));

        dbQuestions.forEach(row => {
            const pNum = Number(row.part_number);
            const dbIdStr = String(row.id);
            const localId = dbToLocalMap[Number(row.id)];
            if (pNum === 1) {
                validP1QuestionIds.add(dbIdStr);
                if (localId !== undefined) validP1QuestionIds.add(String(localId));
            } else if (pNum === 2) {
                validP2QuestionIds.add(dbIdStr);
                if (localId !== undefined) validP2QuestionIds.add(String(localId));
            } else if (pNum === 3) {
                validP3QuestionIds.add(dbIdStr);
                if (localId !== undefined) validP3QuestionIds.add(String(localId));
            }
        });

        // Chuẩn hóa câu trả lời của học sinh từ payload
        let p1Answers: { [key: string]: any } = {};
        let p2Answers: { [key: string]: any } = {};
        let p3Answers: { [key: string]: any } = {};

        const rawItems: any[] = Array.isArray(student_answers) 
            ? student_answers 
            : (Array.isArray(answers) ? answers : []);

        if (rawItems.length > 0) {
            // KIỂM TRA QUESTION OWNERSHIP:
            // Không cho phép nộp câu hỏi thuộc về exam khác (chống gian lận/sai lệch)
            const numericQuestionIds = rawItems
                .map(item => Number(item.question_id || item.id))
                .filter(id => !isNaN(id) && id > 0);

            if (numericQuestionIds.length > 0) {
                const foreignCheck = await pool.query(
                    `SELECT id, quiz_id FROM questions WHERE id = ANY($1::int[]) AND quiz_id != $2`,
                    [numericQuestionIds, examId]
                );
                if (foreignCheck.rows.length > 0) {
                    res.status(400).json({ 
                        message: 'Phát hiện câu hỏi không thuộc đề thi này!',
                        invalid_question_id: foreignCheck.rows[0].id
                    });
                    return;
                }
            }

            for (const item of rawItems) {
                const qIdRaw = item.question_id ?? item.id;
                if (qIdRaw === undefined || qIdRaw === null || qIdRaw === '') continue;
                const qIdStr = String(qIdRaw);
                const qIdNum = Number(qIdRaw);
                const studentAns = item.student_answer ?? item.answer;

                // XÁC ĐỊNH PART THEO SERVER-SIDE TRUTH:
                // KHÔNG mặc định câu hỏi thiếu part là part1
                let resolvedPart: number | null = null;

                // Ưu tiên 1: Tra cứu DB question ID
                if (!isNaN(qIdNum) && dbQuestionById.has(qIdNum)) {
                    const dbQ = dbQuestionById.get(qIdNum);
                    resolvedPart = Number(dbQ.part_number);
                } 
                // Ưu tiên 2: Thuộc tính part/part_number từ payload (nếu hợp lệ)
                else if (item.part === 'part2' || item.part === 2 || item.part_number === 2) {
                    resolvedPart = 2;
                } else if (item.part === 'part3' || item.part === 3 || item.part_number === 3) {
                    resolvedPart = 3;
                } else if (item.part === 'part1' || item.part === 1 || item.part_number === 1) {
                    resolvedPart = 1;
                } 
                // Ưu tiên 3: Nếu không có part từ client, tra cứu vào tập câu hỏi Part 2 / Part 3 / Part 1 của đề thi
                else {
                    if (validP2QuestionIds.has(qIdStr) && !validP1QuestionIds.has(qIdStr) && !validP3QuestionIds.has(qIdStr)) {
                        resolvedPart = 2;
                    } else if (validP3QuestionIds.has(qIdStr) && !validP1QuestionIds.has(qIdStr) && !validP2QuestionIds.has(qIdStr)) {
                        resolvedPart = 3;
                    } else if (validP1QuestionIds.has(qIdStr) && !validP2QuestionIds.has(qIdStr) && !validP3QuestionIds.has(qIdStr)) {
                        resolvedPart = 1;
                    } else if (validP2QuestionIds.has(qIdStr)) {
                        resolvedPart = 2;
                    } else if (validP3QuestionIds.has(qIdStr)) {
                        resolvedPart = 3;
                    } else if (validP1QuestionIds.has(qIdStr)) {
                        resolvedPart = 1;
                    }
                }

                if (resolvedPart === 2) {
                    p2Answers[qIdStr] = studentAns;
                    if (!isNaN(qIdNum) && dbToLocalMap[qIdNum] !== undefined) {
                        p2Answers[String(dbToLocalMap[qIdNum])] = studentAns;
                    }
                } else if (resolvedPart === 3) {
                    p3Answers[qIdStr] = studentAns;
                    if (!isNaN(qIdNum) && dbToLocalMap[qIdNum] !== undefined) {
                        p3Answers[String(dbToLocalMap[qIdNum])] = studentAns;
                    }
                } else if (resolvedPart === 1) {
                    p1Answers[qIdStr] = studentAns;
                    if (!isNaN(qIdNum) && dbToLocalMap[qIdNum] !== undefined) {
                        p1Answers[String(dbToLocalMap[qIdNum])] = studentAns;
                    }
                } else {
                    // Câu hỏi không thuộc part nào -> Không ép vào part1
                    console.warn(`[submitExam] Câu hỏi ${qIdStr} không thể xác định part, bỏ qua`);
                }
            }
        } else if (student_answers && typeof student_answers === 'object') {
            // Nested payload: { part1, part2, part3 }
            p1Answers = { ...(student_answers.part1 || {}) };
            p2Answers = { ...(student_answers.part2 || {}) };
            p3Answers = { ...(student_answers.part3 || {}) };

            Object.entries(p1Answers).forEach(([k, v]) => {
                const numK = Number(k);
                if (!isNaN(numK) && dbToLocalMap[numK] !== undefined) {
                    p1Answers[String(dbToLocalMap[numK])] = v;
                }
                if (localToDbP1[k]) {
                    p1Answers[String(localToDbP1[k])] = v;
                }
            });
            Object.entries(p2Answers).forEach(([k, v]) => {
                const numK = Number(k);
                if (!isNaN(numK) && dbToLocalMap[numK] !== undefined) {
                    p2Answers[String(dbToLocalMap[numK])] = v;
                }
                if (localToDbP2[k]) {
                    p2Answers[String(localToDbP2[k])] = v;
                }
            });
            Object.entries(p3Answers).forEach(([k, v]) => {
                const numK = Number(k);
                if (!isNaN(numK) && dbToLocalMap[numK] !== undefined) {
                    p3Answers[String(dbToLocalMap[numK])] = v;
                }
                if (localToDbP3[k]) {
                    p3Answers[String(localToDbP3[k])] = v;
                }
            });
        }

        // Xây dựng bộ key chấm điểm chuẩn xác
        let p1KeyEntries = Object.entries(rawPart1Key);
        let p2KeyEntries = Object.entries(rawPart2Key);
        let p3KeyEntries = Object.entries(rawPart3Key);

        if (p1KeyEntries.length === 0 && dbQuestions.some(q => q.part_number === 1)) {
            p1KeyEntries = dbQuestions
                .filter(q => q.part_number === 1)
                .map(q => {
                    let localId = q.id;
                    try { const c = typeof q.content === 'string' ? JSON.parse(q.content) : q.content; if (c?.id) localId = c.id; } catch {}
                    return [String(localId), typeof q.answer_data === 'string' ? q.answer_data : JSON.stringify(q.answer_data)];
                });
        }
        if (p2KeyEntries.length === 0 && dbQuestions.some(q => q.part_number === 2)) {
            p2KeyEntries = dbQuestions
                .filter(q => q.part_number === 2)
                .map(q => {
                    let localId = q.id;
                    try { const c = typeof q.content === 'string' ? JSON.parse(q.content) : q.content; if (c?.id) localId = c.id; } catch {}
                    return [String(localId), q.answer_data];
                });
        }
        if (p3KeyEntries.length === 0 && dbQuestions.some(q => q.part_number === 3)) {
            p3KeyEntries = dbQuestions
                .filter(q => q.part_number === 3)
                .map(q => {
                    let localId = q.id;
                    try { const c = typeof q.content === 'string' ? JSON.parse(q.content) : q.content; if (c?.id) localId = c.id; } catch {}
                    return [String(localId), typeof q.answer_data === 'string' ? q.answer_data : String(q.answer_data)];
                });
        }

        const p1Total = p1KeyEntries.length;
        const p2Total = p2KeyEntries.length;
        const p3Total = p3KeyEntries.length;

        // Nhận diện đề Tiếng Anh (thuộc tính part trống hoặc chỉ có part1)
        const isEnglishExam = p1Total > 0 && p2Total === 0 && p3Total === 0;

        let p1Score = 0;
        let p2Score = 0;
        let p3Score = 0;
        let p1Correct = 0;
        let p2Correct = 0;
        let p3Correct = 0;

        const details: any[] = [];

        // THUẬT TOÁN 1: ĐỀ TIẾNG ANH (CHỈ CÓ TRẮC NGHIỆM 4 LỰA CHỌN)
        if (isEnglishExam) {
            const pointPerQuestion = p1Total > 0 ? (10.0 / p1Total) : 0.2;

            for (const [qStr, correctAns] of p1KeyEntries) {
                const qId = Number(qStr);
                const sAns = p1Answers[qStr] ?? p1Answers[qId] ?? (localToDbP1[qStr] ? p1Answers[localToDbP1[qStr]] : undefined) ?? '';
                const isCorrect = (String(sAns).trim().toUpperCase() === String(correctAns).trim().toUpperCase()) && Boolean(sAns);
                const scoreEarned = isCorrect ? pointPerQuestion : 0;

                if (isCorrect) {
                    p1Correct++;
                    p1Score += pointPerQuestion;
                }

                details.push({
                    question_id: qId,
                    part: 'part1',
                    student_answer: sAns || null,
                    correct_answer: correctAns,
                    is_correct: isCorrect,
                    score_earned: Math.round(scoreEarned * 100) / 100,
                    max_score: Math.round(pointPerQuestion * 100) / 100
                });
            }
        } 
        // THUẬT TOÁN 2: ĐỀ KHOA HỌC / TOÁN (CÓ PART 1, PART 2, PART 3)
        else {
            // Phần 1: Trắc nghiệm 4 lựa chọn (0.25 điểm / câu)
            for (const [qStr, correctAns] of p1KeyEntries) {
                const qId = Number(qStr);
                const sAns = p1Answers[qStr] ?? p1Answers[qId] ?? (localToDbP1[qStr] ? p1Answers[localToDbP1[qStr]] : undefined) ?? '';
                const isCorrect = (String(sAns).trim().toUpperCase() === String(correctAns).trim().toUpperCase()) && Boolean(sAns);
                const scoreEarned = isCorrect ? 0.25 : 0;

                if (isCorrect) {
                    p1Correct++;
                    p1Score += 0.25;
                }

                details.push({
                    question_id: qId,
                    part: 'part1',
                    student_answer: sAns || null,
                    correct_answer: correctAns,
                    is_correct: isCorrect,
                    score_earned: scoreEarned,
                    max_score: 0.25
                });
            }

            // Phần 2: Trắc nghiệm Đúng / Sai 4 ý a, b, c, d
            for (const [qStr, keyObj] of p2KeyEntries) {
                const qId = Number(qStr);
                const sObj = p2Answers[qStr] ?? p2Answers[qId] ?? (localToDbP2[qStr] ? p2Answers[localToDbP2[qStr]] : undefined) ?? {};
                const correctObj = (typeof keyObj === 'string' ? JSON.parse(keyObj) : keyObj) || {};

                let correctCount = 0;
                const statementResults: any[] = [];

                if (typeof correctObj === 'object' && !Array.isArray(correctObj) && correctObj !== null) {
                    ['a', 'b', 'c', 'd'].forEach((stmt) => {
                        const sVal = sObj && typeof sObj === 'object' ? sObj[stmt] : undefined;
                        const cVal = correctObj[stmt];
                        const normS = normalizeTrueFalse(sVal);
                        const normC = normalizeTrueFalse(cVal);
                        const stmtCorrect = Boolean(normS && normS === normC);
                        if (stmtCorrect) correctCount++;

                        statementResults.push({
                            statement: stmt,
                            student: normS || null,
                            correct: normC || null,
                            is_correct: stmtCorrect
                        });
                    });
                } else {
                    const normS = normalizeTrueFalse(sObj);
                    const normC = normalizeTrueFalse(correctObj);
                    if (normS && normS === normC) correctCount = 4;
                }

                let qScore = 0;
                if (correctCount === 1) qScore = 0.1;
                else if (correctCount === 2) qScore = 0.25;
                else if (correctCount === 3) qScore = 0.5;
                else if (correctCount === 4) qScore = 1.0;

                p2Score += qScore;
                if (correctCount === 4) p2Correct++;

                details.push({
                    question_id: qId,
                    part: 'part2',
                    student_answer: sObj,
                    correct_answer: correctObj,
                    is_correct: correctCount === 4,
                    correct_statements_count: correctCount,
                    score_earned: qScore,
                    max_score: 1.0,
                    statement_results: statementResults
                });
            }

            // Phần 3: Trắc nghiệm Trả lời ngắn
            const part3PointPerQuestion = p1Total >= 18 ? 0.25 : 0.5;

            for (const [qStr, correctAns] of p3KeyEntries) {
                const qId = Number(qStr);
                const rawStudentAns = p3Answers[qStr] ?? p3Answers[qId] ?? (localToDbP3[qStr] ? p3Answers[localToDbP3[qStr]] : undefined) ?? '';
                const studentVal = normalizeShortAnswer(rawStudentAns);
                const keyVal = normalizeShortAnswer(correctAns);

                let isCorrect = (studentVal === keyVal && studentVal !== '' && keyVal !== '');
                if (!isCorrect && studentVal !== '' && keyVal !== '') {
                    const numStudent = Number(studentVal);
                    const numKey = Number(keyVal);
                    if (!isNaN(numStudent) && !isNaN(numKey) && numStudent === numKey) {
                        isCorrect = true;
                    }
                }
                const scoreEarned = isCorrect ? part3PointPerQuestion : 0;

                if (isCorrect) {
                    p3Correct++;
                    p3Score += part3PointPerQuestion;
                }

                details.push({
                    question_id: qId,
                    part: 'part3',
                    student_answer: rawStudentAns ?? '',
                    correct_answer: correctAns,
                    is_correct: isCorrect,
                    score_earned: scoreEarned,
                    max_score: part3PointPerQuestion
                });
            }
        }

        // Sắp xếp chi tiết câu hỏi theo id tăng dần
        details.sort((a, b) => a.question_id - b.question_id);

        const totalScore = Math.min(10.0, Math.round((p1Score + p2Score + p3Score) * 100) / 100);
        const roundedP1Score = Math.round(p1Score * 100) / 100;
        const roundedP2Score = Math.round(p2Score * 100) / 100;
        const roundedP3Score = Math.round(p3Score * 100) / 100;
        const cheatCountNum = Number(cheat_count) || 0;
        const timeTakenNum = Number(time_taken_seconds) || 0;

        const normalizedAnswersPayload = {
            part1: p1Answers,
            part2: p2Answers,
            part3: p3Answers
        };

        const client = await pool.connect();
        let submitResult;

        try {
            await client.query('BEGIN');

            // KIỂM TRA IDEMPOTENCY (CHỐNG DOUBLE-CLICK / RETRY)
            const recentSubmit = await client.query(
                `SELECT id, is_performance_aggregated, total_score, part1_score, part2_score, part3_score, cheat_count, time_taken_seconds, answers 
                 FROM exam_submissions 
                 WHERE student_id = $1 AND document_id = $2 AND status = 'COMPLETED' 
                 AND submitted_at > NOW() - INTERVAL '10 seconds'
                 ORDER BY submitted_at DESC LIMIT 1`,
                [studentId, examId]
            );

            if (recentSubmit.rows.length > 0) {
                await client.query('ROLLBACK');
                client.release();
                const prev = recentSubmit.rows[0];
                res.status(200).json({ 
                    message: 'Bài thi đã được nộp thành công (Idempotent)',
                    submissionId: prev.id,
                    score: { 
                        totalScore: prev.total_score, 
                        p1Score: prev.part1_score, 
                        p2Score: prev.part2_score, 
                        p3Score: prev.part3_score,
                        allow_view_answers: answerKey.allow_view_answers
                    },
                    summary: {
                        total_score: prev.total_score,
                        total_correct: p1Correct + p2Correct + p3Correct,
                        total_questions: p1Total + p2Total + p3Total,
                        cheat_count: prev.cheat_count,
                        time_taken_seconds: prev.time_taken_seconds,
                        part1: { correct: p1Correct, total: p1Total, score: prev.part1_score },
                        part2: { correct: p2Correct, total: p2Total, score: prev.part2_score },
                        part3: { correct: p3Correct, total: p3Total, score: prev.part3_score }
                    },
                    cheat_count: prev.cheat_count,
                    details: typeof prev.answers === 'string' ? JSON.parse(prev.answers) : prev.answers
                });
                return;
            }

            // Lưu kết quả nộp bài vào bảng exam_submissions
            const existDraft = await client.query(
                `SELECT id, is_performance_aggregated FROM exam_submissions WHERE student_id = $1 AND document_id = $2 AND status = 'IN_PROGRESS' FOR UPDATE`,
                [studentId, examId]
            );

            if (existDraft.rows.length > 0) {
                submitResult = await client.query(
                    `UPDATE exam_submissions 
                     SET student_answers = $1, total_score = $2, part1_score = $3, part2_score = $4, part3_score = $5, 
                         cheat_count = $6, time_taken_seconds = $7, answers = $8, status = 'COMPLETED', submitted_at = NOW()
                     WHERE id = $9 RETURNING *`,
                    [normalizedAnswersPayload, totalScore, roundedP1Score, roundedP2Score, roundedP3Score, cheatCountNum, timeTakenNum, JSON.stringify(details), existDraft.rows[0].id]
                );
            } else {
                submitResult = await client.query(
                    `INSERT INTO exam_submissions (document_id, student_id, student_answers, total_score, part1_score, part2_score, part3_score, cheat_count, time_taken_seconds, answers, status, submitted_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'COMPLETED', NOW()) RETURNING *`,
                    [examId, studentId, normalizedAnswersPayload, totalScore, roundedP1Score, roundedP2Score, roundedP3Score, cheatCountNum, timeTakenNum, JSON.stringify(details)]
                );
            }

            // ========================================================
            // PHASE 5: TÍNH TOÁN HIỆU SUẤT THEO CHUYÊN ĐỀ (ANALYTICS)
            // ========================================================
            // Gom nhóm hiệu suất theo topic trong bài làm này (xác định chuẩn theo Part và ID)
            const topicPerformance: Record<string, { attempts: number, corrects: number }> = {};
            
            for (const detail of details) {
                let q: any = null;
                if (detail.part === 'part2') {
                    q = (examContent.part2 || []).find((x: any) => String(x.id) === String(detail.question_id));
                } else if (detail.part === 'part3') {
                    q = (examContent.part3 || []).find((x: any) => String(x.id) === String(detail.question_id));
                } else {
                    q = (examContent.part1 || []).find((x: any) => String(x.id) === String(detail.question_id));
                }

                if (!q && dbQuestions.length > 0) {
                    const matchedDb = dbQuestions.find((row: any) => {
                        if (String(row.id) === String(detail.question_id)) return true;
                        const pNum = detail.part === 'part2' ? 2 : detail.part === 'part3' ? 3 : 1;
                        if (Number(row.part_number) === pNum) {
                            try {
                                const c = typeof row.content === 'string' ? JSON.parse(row.content) : row.content;
                                return String(c?.id) === String(detail.question_id);
                            } catch { return false; }
                        }
                        return false;
                    });
                    if (matchedDb) {
                        try {
                            q = typeof matchedDb.content === 'string' ? JSON.parse(matchedDb.content) : matchedDb.content;
                        } catch { q = null; }
                    }
                }

                const topic = q?.sub_topic || q?.topic || q?.main_topic || 'Chưa phân loại';

                if (!topicPerformance[topic]) {
                    topicPerformance[topic] = { attempts: 0, corrects: 0 };
                }
                
                topicPerformance[topic].attempts += 1;
                if (detail.is_correct) {
                    topicPerformance[topic].corrects += 1;
                }
            }

            if (!submitResult.rows[0].is_performance_aggregated) {
                // Upsert vào bảng student_topic_performance
                for (const [topic, stats] of Object.entries(topicPerformance)) {
                    await client.query(
                        `INSERT INTO student_topic_performance (student_id, topic_name, total_questions, correct_answers, accuracy_rate)
                         VALUES ($1, $2, $3, $4, $5)
                         ON CONFLICT (student_id, topic_name) DO UPDATE SET 
                            total_questions = student_topic_performance.total_questions + EXCLUDED.total_questions,
                            correct_answers = student_topic_performance.correct_answers + EXCLUDED.correct_answers,
                            accuracy_rate = CASE 
                              WHEN (student_topic_performance.total_questions + EXCLUDED.total_questions) > 0 
                              THEN ROUND(CAST((student_topic_performance.correct_answers + EXCLUDED.correct_answers) AS NUMERIC) * 100.0 / (student_topic_performance.total_questions + EXCLUDED.total_questions), 2)
                              ELSE 0
                            END,
                            last_updated = CURRENT_TIMESTAMP`,
                        [
                            studentId, 
                            topic, 
                            stats.attempts, 
                            stats.corrects, 
                            stats.attempts > 0 ? Math.round((stats.corrects / stats.attempts) * 100 * 100) / 100 : 0
                        ]
                    );
                }

                // Lưu topic_performance JSONB vào exam_submissions
                const topicPerformanceJsonb: Record<string, { correct: number; total: number }> = {};
                for (const [topic, stats] of Object.entries(topicPerformance)) {
                    topicPerformanceJsonb[topic] = { correct: stats.corrects, total: stats.attempts };
                }
                
                await client.query(
                    `UPDATE exam_submissions SET topic_performance = $1, is_performance_aggregated = TRUE WHERE id = $2`,
                    [JSON.stringify(topicPerformanceJsonb), submitResult.rows[0].id]
                );
            }
            await client.query('COMMIT');
        } catch (analyticsErr) {
            await client.query('ROLLBACK');
            console.error('Lỗi lưu kết quả thi:', analyticsErr);
            res.status(500).json({ message: 'Lỗi server khi nộp bài thi', detail: (analyticsErr).message });
            return;
        } finally {
            client.release();
        }

        res.status(200).json({ 
            message: 'Nộp bài và chấm điểm thành công!',
            submissionId: submitResult.rows[0].id,
            score: { 
                totalScore, 
                p1Score: roundedP1Score, 
                p2Score: roundedP2Score, 
                p3Score: roundedP3Score,
                allow_view_answers: answerKey.allow_view_answers
            },
            summary: {
                total_score: totalScore,
                total_correct: p1Correct + p2Correct + p3Correct,
                total_questions: p1Total + p2Total + p3Total,
                cheat_count: cheatCountNum,
                time_taken_seconds: timeTakenNum,
                part1: { correct: p1Correct, total: p1Total, score: roundedP1Score },
                part2: { correct: p2Correct, total: p2Total, score: roundedP2Score },
                part3: { correct: p3Correct, total: p3Total, score: roundedP3Score }
            },
            cheat_count: cheatCountNum,
            details: details
        });
    } catch (error) {
        console.error('Lỗi chấm điểm:', error);
        res.status(500).json({ message: 'Lỗi server khi xử lý bài thi', detail: (error as Error).message });
    }
};

// ========================================================
// 3. API GIÁO VIÊN: LẤY DANH SÁCH BÀI NỘP CỦA HỌC SINH
// ========================================================
export const getExamSubmissions = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { document_id } = req.params;
        const result = await pool.query(
            `SELECT 
                es.id,
                es.document_id,
                es.student_id,
                s.full_name as student_name,
                es.total_score,
                es.part1_score,
                es.part2_score,
                es.part3_score,
                es.student_answers,
                es.answers AS detailed_results,
                es.cheat_count,
                es.submitted_at,
                es.time_taken_seconds
             FROM exam_submissions es 
             JOIN students s ON es.student_id = s.id 
             WHERE es.document_id = $1 
             ORDER BY es.total_score DESC, es.submitted_at DESC`,
            [document_id]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Lỗi lấy dữ liệu bài thi:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};


// ========================================================
// 4. API HỌC SINH: LẤY LỊCH SỬ THI CÁ NHÂN
// ========================================================
// 4. API HỌC SINH: LẤY LỊCH SỬ ĐIỂM THI CÁ NHÂN (TẤT CẢ LẦN THI)
// ========================================================
export const getMySubmissions = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const studentId = req.user?.student_id || req.user?.id;
        const result = await pool.query(
            `SELECT 
                es.id,
                es.document_id,
                d.title,
                es.total_score,
                es.part1_score,
                es.part2_score,
                es.part3_score,
                es.cheat_count,
                es.submitted_at,
                es.time_taken_seconds,
                COALESCE(ek.allow_view_answers, false) as allow_view_answers,
                ek.duration_minutes
             FROM exam_submissions es
             LEFT JOIN documents d ON d.id = es.document_id
             LEFT JOIN exam_keys ek ON ek.document_id = es.document_id
             WHERE es.student_id = $1 AND es.status = 'COMPLETED'
             ORDER BY es.submitted_at DESC`,
            [studentId]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Lỗi lấy điểm cá nhân:', error);
        res.status(500).json({ message: 'Lỗi server khi lấy lịch sử bài thi' });
    }
};

// ========================================================
// 4.1 API CHI TIẾT 1 LẦN THI CỤ THỂ (ATTEMPT DETAIL & REVIEW)
// ========================================================
export const getSubmissionDetail = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params; // submission id
        const user = req.user;

        const subRes = await pool.query(
            `SELECT es.*, d.title as exam_title, ek.allow_view_answers, ek.duration_minutes, ek.exam_content
             FROM exam_submissions es
             JOIN documents d ON es.document_id = d.id
             LEFT JOIN exam_keys ek ON es.document_id = ek.document_id
             WHERE es.id = $1`,
            [id]
        );

        if (subRes.rows.length === 0) {
            res.status(404).json({ message: 'Không tìm thấy bài thi' });
            return;
        }

        const submission = subRes.rows[0];

        // Authorization: student can only view their own submissions; teachers/admins can view any
        const currentStudentId = user?.student_id || user?.id;
        if (user?.role === 'STUDENT' && Number(submission.student_id) !== Number(currentStudentId)) {
            res.status(403).json({ message: 'Bạn không có quyền xem kết quả bài thi này' });
            return;
        }

        const allowView = Boolean(submission.allow_view_answers || user?.role === 'TEACHER' || user?.role === 'ADMIN');
        let parsedDetails = typeof submission.answers === 'string' ? JSON.parse(submission.answers) : (submission.answers || []);

        if (user?.role === 'STUDENT' && !allowView) {
            // Strip correct answers if teacher has not allowed answer viewing
            parsedDetails = parsedDetails.map((d: any) => ({
                question_id: d.question_id,
                part: d.part,
                student_answer: d.student_answer,
                score_earned: d.score_earned,
                max_score: d.max_score,
                is_correct: d.is_correct
            }));
        }

        let examContent = submission.exam_content || {};
        if (user?.role === 'STUDENT' && !allowView) {
            const stripped = JSON.parse(JSON.stringify(examContent));
            ['part1', 'part2', 'part3'].forEach(part => {
                if (Array.isArray(stripped[part])) {
                    stripped[part].forEach((q: any) => {
                        delete q.correctAnswer;
                        delete q.explanation;
                        delete q.solution;
                    });
                }
            });
            examContent = stripped;
        }

        res.status(200).json({
            id: submission.id,
            document_id: submission.document_id,
            exam_title: submission.exam_title,
            student_id: submission.student_id,
            total_score: submission.total_score,
            part1_score: submission.part1_score,
            part2_score: submission.part2_score,
            part3_score: submission.part3_score,
            cheat_count: submission.cheat_count,
            time_taken_seconds: submission.time_taken_seconds,
            submitted_at: submission.submitted_at,
            allow_view_answers: submission.allow_view_answers,
            student_answers: submission.student_answers,
            details: parsedDetails,
            exam_content: examContent
        });
    } catch (error) {
        console.error('Lỗi getSubmissionDetail:', error);
        res.status(500).json({ message: 'Lỗi server khi lấy chi tiết bài thi' });
    }
};

// ========================================================
// 5. API GIÁO VIÊN/HỌC SINH: LẤY DỮ LIỆU ĐỀ THI
// ========================================================
export const getExamKey = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { document_id } = req.params;
        const user = req.user;
        const contentOnly = req.query.contentOnly === 'true';
        
        const result = await pool.query(
            `SELECT part1_key, part2_key, part3_key, allow_view_answers, duration_minutes, exam_content 
             FROM exam_keys WHERE document_id = $1`,
            [document_id]
        );
        
        if (result.rows.length === 0) {
            res.status(200).json(null);
            return;
        }

        const data = result.rows[0];

        // Nếu là học sinh:
        if (user && user.role === 'STUDENT') {
            if (contentOnly) {
                // Khi đang làm bài thi: ẩn toàn bộ đáp án đúng & lời giải
                const strippedContent = data.exam_content ? JSON.parse(JSON.stringify(data.exam_content)) : null;
                if (strippedContent) {
                    if (Array.isArray(strippedContent.part1)) {
                        strippedContent.part1.forEach((q: any) => { delete q.correctAnswer; delete q.explanation; delete q.solution; });
                    }
                    if (Array.isArray(strippedContent.part2)) {
                        strippedContent.part2.forEach((q: any) => { delete q.correctAnswer; delete q.explanation; delete q.solution; });
                    }
                    if (Array.isArray(strippedContent.part3)) {
                        strippedContent.part3.forEach((q: any) => { delete q.correctAnswer; delete q.explanation; delete q.solution; });
                    }
                }
                res.status(200).json({
                    exam_content: strippedContent,
                    duration_minutes: data.duration_minutes,
                    allow_view_answers: data.allow_view_answers
                });
                return;
            } else if (!data.allow_view_answers) {
                // Giáo viên đã khóa tính năng xem đáp án
                res.status(403).json({ message: 'Giáo viên chưa mở quyền xem đáp án đề thi này.' });
                return;
            }
        }

        res.status(200).json(data);
    } catch (error) {
        console.error('Lỗi lấy dữ liệu đề thi:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// ========================================================
// 6. API MỚI: TỰ ĐỘNG TẠO ĐỀ VÀ ĐÁP ÁN TỪ VĂN BẢN (GEMINI)
// ========================================================
export const createExamFromText = async (req: AuthRequest, res: Response): Promise<void> => {
    const { rawText, class_id, document_id, durationMinutes } = req.body;
  
    try {
      // 1. Gửi văn bản cho Gemini xử lý (Đã sửa lại gọi đúng hàm Text)
    const fullExam = await parseFullExamWithGemini(rawText);  
      // 2. Trích xuất đáp án đúng của từng phần
      const part1Key = fullExam.part1.reduce((acc: any, q: any) => { acc[q.id] = q.correctAnswer; return acc; }, {});
      const part2Key = fullExam.part2.reduce((acc: any, q: any) => { acc[q.id] = q.correctAnswer; return acc; }, {});
      const part3Key = fullExam.part3.reduce((acc: any, q: any) => { acc[q.id] = q.correctAnswer; return acc; }, {});
  
      // 3. KHÔNG LƯU DATABASE TỰ ĐỘNG NỮA. CHỈ TRẢ VỀ CHO FRONTEND.
      res.status(200).json({
        message: 'Bóc tách văn bản thành công! Vui lòng kiểm tra và chỉnh sửa trước khi lưu.',
        examKey: {
            part1_key: part1Key,
            part2_key: part2Key,
            part3_key: part3Key,
            document_id: document_id,
            class_id: class_id,
            duration_minutes: durationMinutes || 50
        },
        examContent: fullExam, 
      });
    } catch (error: any) {
        console.error('Lỗi nhận và xử lý file:', error);
        const errMessage = String(error.message || error);
        if (errMessage.includes('fetch failed') || errMessage.includes('TIMEOUT') || errMessage.includes('timeout')) {
            res.status(504).json({ status: "error", message: "File quá dài hoặc AI đang quá tải, phản hồi quá lâu. Vui lòng chia nhỏ file hoặc thử lại sau." });
            return;
        }
        res.status(500).json({ message: 'Lỗi server khi AI xử lý file', detail: error.message });
    }
};

// ========================================================
// 7. API MỚI: TỰ ĐỘNG TẠO ĐỀ TỪ FILE (PDF/ẢNH)
// ========================================================
export const parseExamFromFile = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { document_id, class_id, durationMinutes } = req.body;
        const file = (req as any).file; 

        if (!file) {
            res.status(400).json({ message: 'Không tìm thấy file tải lên!' });
            return;
        }

        let secure_url = '';
        try {
            secure_url = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    { folder: 'documents', resource_type: 'auto' },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result.secure_url);
                    }
                );
                uploadStream.end(file.buffer);
            });
        } catch (uploadError) {
            console.error('Cloudinary upload error:', uploadError);
            res.status(500).json({ message: 'Lỗi tải file lên máy chủ lưu trữ (Cloudinary).' });
            return;
        }

        if (!secure_url) {
            res.status(500).json({ message: 'Không lấy được URL file.' });
            return;
        }


        // 1. LUÔN LUÔN tạo document TRƯỚC
        let actual_document_id = parseInt(String(document_id), 10);
          let folderId = null;
          if (!actual_document_id || actual_document_id === 0) {
            // Find EXAM folder for this class_id
            if (class_id) {
                const folderCheck = await pool.query("SELECT id FROM folders WHERE class_id = $1 AND category = 'EXAM'", [class_id]);
                if (folderCheck.rows.length > 0) {
                    folderId = folderCheck.rows[0].id;
                } else {
                    const newFolder = await pool.query(
                        "INSERT INTO folders (name, category, class_id) VALUES ('Đề thi', 'EXAM', $1) RETURNING id",
                        [class_id]
                    );
                    folderId = newFolder.rows[0].id;
                }
            }
            
            const docRes = await pool.query(
                `INSERT INTO documents (title, file_url, category, folder_id) VALUES ($1, $2, 'EXAM', $3) RETURNING id`,
                [file.originalname || 'Đề thi tự động tạo', secure_url, folderId]
            );
            actual_document_id = docRes.rows[0].id;
        }

        console.log('--- ĐANG GỌI FILE CHO GEMINI AI XỬ LÝ ---');
        
        let fullExam = null;
        let part1Key = {};
        let part2Key = {};
        let part3Key = {};

        // 2. Gọi AI trong try-catch
        try {
            fullExam = await parseFullExamFromFileWithGemini(file);
            part1Key = fullExam.part1.reduce((acc: any, q: any) => { acc[q.id] = q.correctAnswer; return acc; }, {});
            part2Key = fullExam.part2.reduce((acc: any, q: any) => { acc[q.id] = q.correctAnswer; return acc; }, {});
            part3Key = fullExam.part3.reduce((acc: any, q: any) => { acc[q.id] = q.correctAnswer; return acc; }, {});
            console.log('--- XỬ LÝ FILE HOÀN TẤT ---');
        } catch (aiError: any) {
            console.error('Lỗi Gemini AI timeout hoặc 429:', aiError);
            res.status(200).json({ 
                status: 'success',
                message: 'Lưu đề thi thành công! (Lưu ý: AI bóc tách thất bại do quá tải, vui lòng nhập câu hỏi thủ công)',
                data: {
                    document_id: actual_document_id,
                    class_id: class_id,
                    duration_minutes: durationMinutes || 50,
                    examKey: { part1_key: {}, part2_key: {}, part3_key: {} },
                    examContent: { part1: [], part2: [], part3: [], shared_context: [] },
                    questions: [],
                    shared_context: []
                }
            });
            return;
        }

        // LƯU VÀO questions ĐỂ KHÔNG BỊ LỖI
        try {
            const allQuestions = [
                ...(fullExam.part1 || []).map((q: any) => ({ ...q, part_number: 1, question_type: 'MULTIPLE_CHOICE' })),
                ...(fullExam.part2 || []).map((q: any) => ({ ...q, part_number: 2, question_type: 'TRUE_FALSE' })),
                ...(fullExam.part3 || []).map((q: any) => ({ ...q, part_number: 3, question_type: 'SHORT_ANSWER' }))
            ];

            await Promise.all(allQuestions.map(q => 
                pool.query(
                    `INSERT INTO questions (quiz_id, part_number, question_type, content, answer_data) VALUES ($1, $2, $3, $4, $5)`,
                    [actual_document_id, q.part_number, q.question_type, JSON.stringify(q), JSON.stringify(q.correctAnswer)]
                )
            ));
        } catch (error: any) {
            res.status(500).json({ message: "Lỗi lưu cơ sở dữ liệu: " + error.message });
            return;
        }

        const resultData = {
            document_id: actual_document_id,
            class_id: class_id,
            duration_minutes: durationMinutes || 50,
            examKey: { part1_key: part1Key, part2_key: part2Key, part3_key: part3Key },
            examContent: fullExam,
            questions: fullExam,
            shared_context: fullExam?.shared_context || []
        };

        res.status(200).json({ status: 'success', data: resultData });
    } catch (error: any) {
        console.error('Lỗi nhận và xử lý file:', error);
        res.status(500).json({ message: 'Lỗi server khi xử lý file', detail: error.message });
    }
};

// ========================================================
// 8. API PHASE 3: LẤY DANH SÁCH NGÂN HÀNG ĐỀ (EXAM BANK)
// ========================================================
export const getAllExams = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const user = req.user;
        let query = `
            SELECT e.*, d.file_url 
            FROM exams e 
            LEFT JOIN documents d ON e.document_id = d.id
        `;
        const values = [];
        if (user && user.role === 'TEACHER') {
            // Assume exams has teacher_id or documents has teacher_id
            query += ` WHERE d.teacher_id = $1 `;
            values.push(user.id);
        }
        query += ` ORDER BY e.created_at DESC`;
        
        const result = await pool.query(query, values);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi lấy danh sách đề thi' });
    }
};

// ========================================================
// 9. API PHASE 3: XUẤT BẢN ĐỀ THI (PUBLISH EXAM)
// ========================================================

export const publishExam = async (req: AuthRequest, res: Response): Promise<void> => {
    const client = await pool.connect();
    try {
        let { document_id, title, grade, subject, duration_minutes, class_id, exam_content } = req.body;
        
        await client.query('BEGIN');

        let folderId: number | null = null;
        if (class_id) {
            const folderCheck = await client.query("SELECT id FROM folders WHERE class_id = $1 AND category = 'EXAM'", [class_id]);
            if (folderCheck.rows.length > 0) {
                folderId = folderCheck.rows[0].id;
            } else {
                const newFolder = await client.query(
                    "INSERT INTO folders (name, category, class_id, teacher_id) VALUES ('Đề thi', 'EXAM', $1, $2) RETURNING id",
                    [class_id, req.user?.id || null]
                );
                folderId = newFolder.rows[0].id;
            }
        }

        // 1. Tạo hoặc cập nhật Document
        let actual_document_id = parseInt(String(document_id), 10);
        if (!actual_document_id || actual_document_id === 0) {
            const docRes = await client.query(
                `INSERT INTO documents (title, category, folder_id, class_id, teacher_id) 
                 VALUES ($1, 'EXAM', $2, $3, $4) RETURNING id`,
                [title || 'Đề thi AI', folderId, class_id || null, req.user?.id || null]
            );
            actual_document_id = docRes.rows[0].id;
        } else {
            await client.query(
                `UPDATE documents SET title = $1, folder_id = $2, class_id = $3, category = 'EXAM' WHERE id = $4`,
                [title, folderId, class_id || null, actual_document_id]
            );
        }

        if (exam_content) {
            // 2. Chuẩn hóa nội dung đề thi với normalizeExamData
            const normalizedContent = normalizeExamData(exam_content);
            const part1_key = normalizedContent.part1?.reduce((acc: any, q: any) => { acc[q.id] = q.correctAnswer; return acc; }, {}) || {};
            const part2_key = normalizedContent.part2?.reduce((acc: any, q: any) => { acc[q.id] = q.correctAnswer; return acc; }, {}) || {};
            const part3_key = normalizedContent.part3?.reduce((acc: any, q: any) => { acc[q.id] = q.correctAnswer; return acc; }, {}) || {};
            
            await client.query(
                `INSERT INTO exam_keys (document_id, class_id, part1_key, part2_key, part3_key, allow_view_answers, duration_minutes, exam_content) 
                 VALUES ($1, $2, $3, $4, $5, true, $6, $7) 
                 ON CONFLICT (document_id) 
                 DO UPDATE SET 
                    class_id = COALESCE($2, exam_keys.class_id),
                    part1_key = $3, part2_key = $4, part3_key = $5,
                    duration_minutes = $6, exam_content = $7`,
                [actual_document_id, class_id, part1_key, part2_key, part3_key, duration_minutes || 50, normalizedContent]
            );

            // 3. Xóa các câu hỏi cũ (nếu có)
            await client.query(`DELETE FROM questions WHERE quiz_id = $1`, [actual_document_id]);

            // 4. Cập nhật lại bảng questions thực tế
            const allQuestions = [
                ...(normalizedContent.part1 || []).map((q: any) => ({ ...q, part_number: 1, question_type: 'MCQ' })),
                ...(normalizedContent.part2 || []).map((q: any) => ({ ...q, part_number: 2, question_type: 'TRUE_FALSE' })),
                ...(normalizedContent.part3 || []).map((q: any) => ({ ...q, part_number: 3, question_type: 'SHORT_ANSWER' }))
            ];
            
            for (const q of allQuestions) {
                await client.query(
                    `INSERT INTO questions (quiz_id, part_number, question_type, content, answer_data) VALUES ($1, $2, $3, $4, $5)`,
                    [actual_document_id, q.part_number, q.question_type, JSON.stringify(q), JSON.stringify(q.correctAnswer)]
                );
            }
        }

        await client.query('COMMIT');
        client.release();

        res.status(200).json({ success: true, message: 'Xuất bản đề thi thành công!', document_id: actual_document_id });
    } catch (error) {
        await client.query('ROLLBACK');
        client.release();
        console.error('Lỗi publish đề:', error);
        res.status(500).json({ message: 'Lỗi xuất bản đề thi', detail: (error as Error).message });
    }
};



import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

export const askAITutor = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const studentId = req.user?.id;
        const { exam_id, question_id, student_question, student_answer: clientStudentAns, part: clientPart } = req.body;

        if (!exam_id || !question_id || !student_question) {
            res.status(400).json({ message: 'Thiếu thông tin cần thiết (exam_id, question_id, student_question)' });
            return;
        }

        // 1. Lấy đề thi và nội dung câu hỏi
        const keyRes = await pool.query("SELECT exam_content, allow_view_answers FROM exam_keys WHERE document_id = $1", [exam_id]);
        if (keyRes.rows.length === 0) {
            res.status(404).json({ message: 'Không tìm thấy dữ liệu đề thi.' });
            return;
        }

        const examContent = keyRes.rows[0].exam_content || {};
        const allQuestions = [
            ...(examContent.part1 || []),
            ...(examContent.part2 || []),
            ...(examContent.part3 || [])
        ];

        let qData: any = null;
        if (clientPart === 'part2') {
            qData = (examContent.part2 || []).find((q: any) => String(q.id) === String(question_id));
        } else if (clientPart === 'part3') {
            qData = (examContent.part3 || []).find((q: any) => String(q.id) === String(question_id));
        } else if (clientPart === 'part1') {
            qData = (examContent.part1 || []).find((q: any) => String(q.id) === String(question_id));
        }
        if (!qData) {
            qData = allQuestions.find((q: any) => String(q.id) === String(question_id));
        }

        if (!qData) {
            res.status(404).json({ message: 'Không tìm thấy câu hỏi.' });
            return;
        }

        // 2. Tìm Shared Context (nếu có)
        const sharedList = examContent.sharedContexts || examContent.shared_context || [];
        const sharedCtx = qData.context_id 
            ? sharedList.find((g: any) => String(g.id) === String(qData.context_id) || String(g.context_id) === String(qData.context_id))
            : sharedList.find((g: any) => (g.questionIds || g.question_ids || []).map(Number).includes(Number(question_id)));
        const sharedContextText = sharedCtx ? `\n[NGỮ LIỆU ĐỌC HIỂU DÙNG CHO CÂU NÀY]: ${sharedCtx.content}` : '';

        // 3. Lấy thông tin bài làm của học sinh (nếu đã nộp)
        let studentAnswer = clientStudentAns || 'Chưa chọn';
        let correctAnswer = qData.correctAnswer || '';
        let solutionText = qData.solution || qData.explanation || 'Chưa có lời giải chi tiết';

        if (studentId) {
            const submissionRes = await pool.query(
                "SELECT student_answers, answers AS detailed_results FROM exam_submissions WHERE student_id = $1 AND document_id = $2 ORDER BY submitted_at DESC LIMIT 1",
                [studentId, exam_id]
            );
            if (submissionRes.rows.length > 0) {
                const submission = submissionRes.rows[0];
                const detailedResults = submission.detailed_results || [];
                const questionDetail = detailedResults.find((q: any) => String(q.question_id) === String(question_id));
                if (questionDetail) {
                    studentAnswer = questionDetail.student_answer ?? studentAnswer;
                    correctAnswer = questionDetail.correct_answer ?? correctAnswer;
                }
            }
        }

        const subTopic = qData.sub_topic || qData.topic || 'Kiến thức tổng hợp';
        const questionContent = qData.questionText || '';
        const optionsText = qData.options ? `\nCác lựa chọn:\nA. ${qData.options.A || ''}\nB. ${qData.options.B || ''}\nC. ${qData.options.C || ''}\nD. ${qData.options.D || ''}` : '';

        const prompt = `Đóng vai một gia sư AI dạy kèm Toán/Khoa học tận tâm và thông minh.
Học sinh đang hỏi về Câu ${question_id} (Chuyên đề: ${subTopic}).${sharedContextText}
Nội dung câu hỏi: ${questionContent}${optionsText}
Đáp án đúng chuẩn: ${JSON.stringify(correctAnswer)}.
Học sinh đã chọn: ${JSON.stringify(studentAnswer)}.
Lời giải tham khảo: ${solutionText}.

Câu hỏi thắc mắc của học sinh: "${student_question}"

Nhiệm vụ của bạn:
1. Dựa vào nội dung câu hỏi và ngữ liệu, trả lời TRỰC TIẾP, NGẮN GỌN, DỄ HIỂU vào đúng điểm học sinh đang thắc mắc.
2. Phân tích bắt bệnh tư duy: nếu học sinh hiểu sai hoặc chọn đáp án sai, hãy chỉ ra lỗ hổng tư duy và hướng dẫn cách suy luận chính xác.
3. Nếu học sinh chỉ đang yêu cầu gợi ý hoặc hỏi cách tư duy phương pháp, KHÔNG vội vàng spoil đáp án cuối cùng ngay lập tức mà hãy dẫn dắt từng bước.
4. Trình bày bằng Markdown, sử dụng LaTeX cho công thức toán học (bọc trong dấu $ cho inline hoặc $$ cho block).`;

        const responseText = await generateWithFallback(prompt);
        res.status(200).json({ answer: responseText });
    } catch (error) {
        console.error('Lỗi askAITutor:', error);
        res.status(500).json({ message: 'Lỗi AI Tutor', detail: (error as Error).message });
    }
};
