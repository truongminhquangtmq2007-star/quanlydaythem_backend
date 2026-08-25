import { generateWithFallback } from '../services/geminiService';
import { Response } from 'express';
import pool from '../db';
import { AuthRequest } from '../middleware/authMiddleware';
// 👇 Nhập hàm gọi Gemini từ service bạn vừa tạo
import {
    parseFullExamWithGemini,
    parseFullExamFromFileWithGemini
} from '../services/geminiService';
// ========================================================
// 1. API GIÁO VIÊN: LƯU ĐÁP ÁN CHUẨN VÀ NỘI DUNG ĐỀ VÀO DATABASE
// ========================================================
export const saveAnswerKey = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        // NHẬN THÊM BIẾN exam_content TỪ FRONTEND
        const { document_id, class_id, part1_key, part2_key, part3_key, allow_view_answers, duration_minutes, exam_content } = req.body;
        
        const documentCheck = await pool.query('SELECT id FROM documents WHERE id = $1', [document_id]);
        
        const folderCheck = await pool.query("SELECT id FROM folders WHERE class_id = $1 AND category = 'EXAM'", [class_id]);
        if (folderCheck.rows.length === 0) {
            res.status(400).json({ message: 'Lớp học này chưa có thư mục Đề thi (EXAM). Vui lòng tạo thư mục trước.' });
            return;
        }
        await pool.query('UPDATE documents SET folder_id = $1 WHERE id = $2', [folderCheck.rows[0].id, document_id]);


        if (documentCheck.rows.length === 0) {
            res.status(400).json({
                message: `Tài liệu có ID ${document_id} không tồn tại`
            });
            return;
        }

        // Đảm bảo bảng exam_keys có cột context_id
        try {
            
        } catch (colErr) {
            // Bỏ qua nếu cột đã tồn tại hoặc không thể thêm
        }

        let primaryContextId: number | null = null;
        let finalExamContent = exam_content;

        // XỬ LÝ CÂU HỎI CHÙM (SHARED CONTEXT)
        const rawShared = exam_content?.shared_context || exam_content?.sharedContexts || req.body.shared_context;
        const sharedList = Array.isArray(rawShared) ? rawShared : rawShared ? [rawShared] : [];

        if (sharedList.length > 0) {
            // Xóa ngữ cảnh cũ của đề thi này nếu có
            await pool.query('DELETE FROM question_contexts WHERE document_id = $1', [document_id]);

            for (const item of sharedList) {
                const content = item.content || item.text || (typeof item === 'string' ? item : '');
                const imageUrl = item.image_url || null;
                const part = item.part || 'part1';
                const questionIds = item.questionIds || item.question_ids || [];

                // Lưu vào bảng question_contexts trước để lấy ID
                const insertContextRes = await pool.query(
                    `INSERT INTO question_contexts (document_id, content, image_url, part, question_ids)
                     VALUES ($1, $2, $3, $4, $5)
                     RETURNING id`,
                    [document_id, content, imageUrl, part, JSON.stringify(questionIds)]
                );

                const contextId = insertContextRes.rows[0]?.id;
                if (!primaryContextId && contextId) {
                    primaryContextId = contextId;
                }

                // Gán context_id vào đối tượng context
                item.id = contextId;
                item.context_id = contextId;

                // Gán context_id vào các câu hỏi con tương ứng trong exam_content
                if (finalExamContent) {
                    const targetPart = (part === 'part2' ? finalExamContent.part2 : part === 'part3' ? finalExamContent.part3 : finalExamContent.part1) || [];
                    targetPart.forEach((q: any) => {
                        if (questionIds.includes(q.id)) {
                            q.context_id = contextId;
                        }
                    });
                }
            }

            if (finalExamContent) {
                finalExamContent.shared_context = sharedList;
                finalExamContent.sharedContexts = sharedList;
            }
        }

        const currentData = await pool.query(
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
        await pool.query(
            `INSERT INTO exam_keys (document_id, class_id, part1_key, part2_key, part3_key, allow_view_answers, duration_minutes, exam_content) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
             ON CONFLICT (document_id) 
             DO UPDATE SET 
                part1_key = $3, part2_key = $4, part3_key = $5,
                allow_view_answers = $6, duration_minutes = $7, exam_content = $8
             RETURNING *`,
            [
                document_id,
                class_id,
                p1,
                p2,
                p3,
                allow_view_answers,
                duration_minutes,
                resolvedExamContent
            ]
        );

        res.status(200).json({ 
            message: 'Lưu đề thi và đáp án thành công!',
            context_id: primaryContextId
        });
    } catch (error) {
        console.error('LỖI LƯU ĐÁP ÁN VÀ NỘI DUNG ĐỀ:', error);
        res.status(500).json({ message: 'Lỗi server', detail: (error as Error).message });
    }
};

const normalizeShortAnswer = (value: any): string => {
    return String(value ?? '')
        .trim()
        .replace(/\s+/g, '')
        .replace(',', '.');
};

// ========================================================
// 1B. API HỌC SINH: LƯU NHÁP VÀ KHÔI PHỤC (AUTO-SAVE)
// ========================================================
export const getDraftExam = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const studentId = req.user?.id;
        const examId = req.params.id;
        const result = await pool.query(
            `SELECT student_answers, last_saved_at, time_taken_seconds FROM exam_submissions 
             WHERE student_id = $1 AND (document_id = $2 OR exam_id = $2) AND status = 'IN_PROGRESS'`,
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
        const studentId = req.user?.id;
        const examId = req.params.id;
        const { answers, time_taken_seconds } = req.body;
        const exist = await pool.query(
            `SELECT id FROM exam_submissions WHERE student_id = $1 AND (document_id = $2 OR exam_id = $2) AND status = 'IN_PROGRESS'`,
            [studentId, examId]
        );

        if (exist.rows.length > 0) {
            await pool.query(
                `UPDATE exam_submissions SET student_answers = $1, time_taken_seconds = $2, last_saved_at = NOW() WHERE id = $3`,
                [JSON.stringify(answers), time_taken_seconds || 0, exist.rows[0].id]
            );
        } else {
            await pool.query(
                `INSERT INTO exam_submissions (document_id, exam_id, student_id, student_answers, time_taken_seconds, status, last_saved_at) 
                 VALUES ($1, $1, $2, $3, $4, 'IN_PROGRESS', NOW())`,
                [examId, studentId, JSON.stringify(answers), time_taken_seconds || 0]
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
        const studentId = req.user?.id;
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

        // Chuẩn hóa câu trả lời của học sinh từ payload
        let p1Answers: { [key: string]: any } = {};
        let p2Answers: { [key: string]: any } = {};
        let p3Answers: { [key: string]: any } = {};
        const flatAnswers: { [key: string]: any } = {};

        if (Array.isArray(student_answers)) {
            student_answers.forEach((item: any) => {
                const qId = String(item.question_id || item.id);
                flatAnswers[qId] = item.student_answer ?? item.answer;
                if (item.part === 'part2') p2Answers[qId] = item.student_answer;
                else if (item.part === 'part3') p3Answers[qId] = item.student_answer;
                else p1Answers[qId] = item.student_answer;
            });
        } else if (Array.isArray(answers)) {
            answers.forEach((item: any) => {
                const qId = String(item.question_id || item.id);
                flatAnswers[qId] = item.student_answer ?? item.answer;
                if (item.part === 'part2') p2Answers[qId] = item.student_answer;
                else if (item.part === 'part3') p3Answers[qId] = item.student_answer;
                else p1Answers[qId] = item.student_answer;
            });
        } else if (student_answers && typeof student_answers === 'object') {
            p1Answers = student_answers.part1 || {};
            p2Answers = student_answers.part2 || {};
            p3Answers = student_answers.part3 || {};
            Object.entries(p1Answers).forEach(([k, v]) => { flatAnswers[k] = v; });
            Object.entries(p2Answers).forEach(([k, v]) => { flatAnswers[k] = v; });
            Object.entries(p3Answers).forEach(([k, v]) => { flatAnswers[k] = v; });
        }

        const rawPart1Key = answerKey.part1_key || {};
        const rawPart2Key = answerKey.part2_key || {};
        const rawPart3Key = answerKey.part3_key || {};

        const p1KeyEntries = Object.entries(rawPart1Key);
        const p2KeyEntries = Object.entries(rawPart2Key);
        const p3KeyEntries = Object.entries(rawPart3Key);

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
                const sAns = p1Answers[qStr] ?? p1Answers[qId] ?? flatAnswers[qStr] ?? flatAnswers[qId] ?? '';
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
                const sAns = p1Answers[qStr] ?? p1Answers[qId] ?? flatAnswers[qStr] ?? flatAnswers[qId] ?? '';
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
                const sObj = p2Answers[qStr] ?? p2Answers[qId] ?? flatAnswers[qStr] ?? flatAnswers[qId] ?? {};
                const correctObj = (keyObj || {}) as { [stmt: string]: string };

                let correctCount = 0;
                const statementResults: any[] = [];

                ['a', 'b', 'c', 'd'].forEach((stmt) => {
                    const sVal = sObj[stmt] ? String(sObj[stmt]).trim() : '';
                    const cVal = correctObj[stmt] ? String(correctObj[stmt]).trim() : '';
                    const stmtCorrect = Boolean(sVal && sVal === cVal);
                    if (stmtCorrect) correctCount++;

                    statementResults.push({
                        statement: stmt,
                        student: sVal || null,
                        correct: cVal || null,
                        is_correct: stmtCorrect
                    });
                });

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
            // Nếu Phần 1 có từ 18 câu trở lên thì mỗi câu Phần 3 là 0.25đ, ngược lại (12 câu) là 0.5đ
            const part3PointPerQuestion = p1Total >= 18 ? 0.25 : 0.5;

            for (const [qStr, correctAns] of p3KeyEntries) {
                const qId = Number(qStr);
                const rawStudentAns = p3Answers[qStr] ?? p3Answers[qId] ?? flatAnswers[qStr] ?? flatAnswers[qId] ?? '';
                const studentVal = normalizeShortAnswer(rawStudentAns);
                const keyVal = normalizeShortAnswer(correctAns);

                const isCorrect = (studentVal === keyVal && studentVal !== '' && keyVal !== '');
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

        // Lưu kết quả nộp bài vào bảng exam_submissions
        const existDraft = await pool.query(
            `SELECT id FROM exam_submissions WHERE student_id = $1 AND (document_id = $2 OR exam_id = $2) AND status = 'IN_PROGRESS'`,
            [studentId, examId]
        );

        let submitResult;
        if (existDraft.rows.length > 0) {
            submitResult = await pool.query(
                `UPDATE exam_submissions 
                 SET student_answers = $1, total_score = $2, part1_score = $3, part2_score = $4, part3_score = $5, 
                     cheat_count = $6, time_taken_seconds = $7, answers = $8, status = 'COMPLETED', submitted_at = NOW()
                 WHERE id = $9 RETURNING *`,
                [normalizedAnswersPayload, totalScore, roundedP1Score, roundedP2Score, roundedP3Score, cheatCountNum, timeTakenNum, JSON.stringify(details), existDraft.rows[0].id]
            );
        } else {
            submitResult = await pool.query(
                `INSERT INTO exam_submissions 
                (document_id, exam_id, student_id, student_answers, total_score, part1_score, part2_score, part3_score, cheat_count, time_taken_seconds, answers, status) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'COMPLETED') RETURNING *`,
                [examId, examId, studentId, normalizedAnswersPayload, totalScore, roundedP1Score, roundedP2Score, roundedP3Score, cheatCountNum, timeTakenNum, JSON.stringify(details)]
            );
        }

        // ========================================================
        // PHASE 5: TÍNH TOÁN HIỆU SUẤT THEO CHUYÊN ĐỀ (ANALYTICS)
        // ========================================================
        try {
            const examContent = answerKey.exam_content || {};
            const allQuestions = [
                ...(examContent.part1 || []),
                ...(examContent.part2 || []),
                ...(examContent.part3 || [])
            ];

            // Gom nhóm hiệu suất theo topic trong bài làm này
            const topicPerformance: Record<string, { attempts: number, corrects: number }> = {};
            
            for (const detail of details) {
                // Thử tìm sub_topic trong exam_content hoặc fallback
                const q = allQuestions.find(x => String(x.id) === String(detail.question_id));
                const topic = q?.sub_topic || q?.topic || 'Chưa phân loại';

                if (!topicPerformance[topic]) {
                    topicPerformance[topic] = { attempts: 0, corrects: 0 };
                }
                
                topicPerformance[topic].attempts += 1;
                if (detail.is_correct) {
                    topicPerformance[topic].corrects += 1;
                }
            }

            // Upsert vào bảng student_topic_performance
            for (const [topic, stats] of Object.entries(topicPerformance)) {
                await pool.query(
                    `INSERT INTO student_topic_performance (student_id, topic, attempt_count, correct_count, accuracy_rate)
                     VALUES ($1, $2, $3, $4, $5)
                     ON CONFLICT (student_id, topic) DO UPDATE SET 
                        attempt_count = student_topic_performance.attempt_count + EXCLUDED.attempt_count,
                        correct_count = student_topic_performance.correct_count + EXCLUDED.correct_count,
                        accuracy_rate = ROUND(CAST((student_topic_performance.correct_count + EXCLUDED.correct_count) AS NUMERIC) * 100.0 / (student_topic_performance.attempt_count + EXCLUDED.attempt_count), 2),
                        last_updated = CURRENT_TIMESTAMP`,
                    [
                        studentId, 
                        topic, 
                        stats.attempts, 
                        stats.corrects, 
                        Math.round((stats.corrects / stats.attempts) * 100 * 100) / 100
                    ]
                );
            }

            // Lưu topic_performance JSONB vào exam_submissions (để getDashboard đọc)
            const topicPerformanceJsonb: Record<string, { correct: number; total: number }> = {};
            for (const [topic, stats] of Object.entries(topicPerformance)) {
                topicPerformanceJsonb[topic] = { correct: stats.corrects, total: stats.attempts };
            }
            if (submitResult.rows[0]?.id) {
                await pool.query(
                    `UPDATE exam_submissions SET topic_performance = $1 WHERE id = $2`,
                    [JSON.stringify(topicPerformanceJsonb), submitResult.rows[0].id]
                );
            }
        } catch (analyticsErr) {
            console.error('Lỗi tính toán Analytics:', analyticsErr);
            // Không block luồng nộp bài nếu lỗi analytics
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
export const getMySubmissions = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const studentId = req.user?.id;
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
        es.time_taken_seconds
     FROM exam_submissions es
     LEFT JOIN documents d ON d.id = es.document_id
     WHERE es.student_id = $1
     ORDER BY es.submitted_at DESC`,
    [studentId]
);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Lỗi lấy điểm cá nhân:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// ========================================================
// 5. API GIÁO VIÊN/HỌC SINH: LẤY DỮ LIỆU ĐỀ THI
// ========================================================
export const getExamKey = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { document_id } = req.params;
        
        // CẬP NHẬT LỆNH SQL: SELECT THÊM exam_content ĐỂ TRẢ VỀ CHO FRONTEND
        const result = await pool.query(
            `SELECT part1_key, part2_key, part3_key, allow_view_answers, duration_minutes, exam_content 
             FROM exam_keys WHERE document_id = $1`,
            [document_id]
        );
        
        if (result.rows.length > 0) {
            res.status(200).json(result.rows[0]);
        } else {
            res.status(200).json(null);
        }
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

        console.log('--- ĐANG GỬI FILE CHO GEMINI AI XỬ LÝ ---');

        // 1. Gửi file cho Gemini xử lý
        const fullExam = await parseFullExamFromFileWithGemini(file);

        // 2. Trích xuất đáp án đúng của từng phần
        const part1Key = fullExam.part1.reduce((acc: any, q: any) => { acc[q.id] = q.correctAnswer; return acc; }, {});
        const part2Key = fullExam.part2.reduce((acc: any, q: any) => { acc[q.id] = q.correctAnswer; return acc; }, {});
        const part3Key = fullExam.part3.reduce((acc: any, q: any) => { acc[q.id] = q.correctAnswer; return acc; }, {});

        console.log('--- XỬ LÝ FILE HOÀN TẤT ---');

        // Ghi lưu Document vào thư viện
        let actual_document_id = document_id;
        if (!actual_document_id) {
            const docRes = await pool.query(
                `INSERT INTO documents (document_code, title, file_url, category, type) VALUES ($1, $2, $3, 'EXAM', 'EXAM') RETURNING id`,
                [`EXAM${Date.now().toString().slice(-6)}`, file.originalname || 'Đề thi tự động tạo', file.path]
            );
            actual_document_id = docRes.rows[0].id;
        }

        res.status(200).json({ 
            message: 'Phân tích file bằng AI thành công! Vui lòng kiểm tra và chỉnh sửa trước khi lưu.',
            examKey: {
                part1_key: part1Key,
                part2_key: part2Key,
                part3_key: part3Key,
                document_id: actual_document_id,
                class_id: class_id,
                duration_minutes: durationMinutes || 50
            },
            examContent: fullExam
        });
    } catch (error: any) {
        console.error('Lỗi nhận và xử lý file:', error);
        res.status(500).json({ message: 'Lỗi server khi AI xử lý file', detail: error.message });
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
    try {
        // Trong hệ thống thực tế, Đề thi đã được lưu vào bảng documents với category='EXAM',
        // và nội dung JSON được lưu vào bảng exam_keys qua hàm saveAnswerKey.
        // Vì vậy không cần insert vào các bảng ảo exams, question_contexts, questions.
        // Chỉ cần trả về 200 OK.
        res.status(200).json({ message: 'Xuất bản đề thi thành công!' });
    } catch (error) {
        console.error('Lỗi publish đề:', error);
        res.status(500).json({ message: 'Lỗi xuất bản đề thi' });
    }
};


import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

export const askAITutor = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const studentId = req.user?.id;
        const { exam_id, question_id, student_question } = req.body;

        if (!studentId || !exam_id || !question_id || !student_question) {
            res.status(400).json({ message: 'Thiếu thông tin cần thiết' });
            return;
        }

        // Lấy thông tin bài thi của học sinh
        const submissionRes = await pool.query(
            "SELECT student_answers, answers AS detailed_results FROM exam_submissions WHERE student_id = $1 AND (document_id = $2 OR exam_id = $2) AND status = 'COMPLETED'",
            [studentId, exam_id]
        );

        if (submissionRes.rows.length === 0) {
            res.status(404).json({ message: 'Không tìm thấy kết quả làm bài của bạn.' });
            return;
        }

        const submission = submissionRes.rows[0];
        const detailedResults = submission.detailed_results || [];
        const questionDetail = detailedResults.find((q: any) => String(q.question_id) === String(question_id));

        // Lấy đề và đáp án chuẩn
        const keyRes = await pool.query("SELECT exam_content FROM exam_keys WHERE document_id = $1", [exam_id]);
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

        const qData = allQuestions.find((q: any) => String(q.id) === String(question_id));

        if (!qData) {
            res.status(404).json({ message: 'Không tìm thấy câu hỏi.' });
            return;
        }

        const subTopic = qData.sub_topic || qData.topic || 'Chưa phân loại';
        const questionContent = qData.questionText || '';
        const correctAnswer = questionDetail?.correct_answer || qData.correctAnswer || '';
        const studentAnswer = questionDetail?.student_answer || 'Không trả lời';
        const solutionText = qData.solution || qData.explanation || 'Không có lời giải chi tiết';

        const prompt = `Đóng vai một giáo viên Toán/Lý tận tâm. Học sinh đang hỏi về 1 câu thuộc chuyên đề ${subTopic}.
Nội dung câu hỏi: ${questionContent}.
Đáp án đúng là: ${JSON.stringify(correctAnswer)}.
Học sinh đã chọn đáp án: ${JSON.stringify(studentAnswer)}.
Lời giải tham khảo: ${solutionText}.

Câu hỏi của học sinh: "${student_question}"

Nhiệm vụ của bạn: Dựa vào lời giải chuẩn, hãy giải thích NGẮN GỌN, DỄ HIỂU, tập trung trả lời đúng vào thắc mắc của học sinh. Chỉ ra vì sao đáp án của học sinh bị sai (bắt bệnh tư duy). Trình bày bằng Markdown, sử dụng LaTeX cho công thức toán học (bọc trong dấu $ hoặc $$). Định hướng giải thích: Nếu là Toán/Lý 12 thì hướng tới cách giải nhanh trắc nghiệm cùng với bản chất lý thuyết; nếu là Lý 11 thì phân tích sâu hiện tượng vật lí. Tránh tình trạng học sinh học vẹt, nội dung câu trả lời không được lan man nhưng phải có bản chất, được đi kèm với mẹo giải nhanh nhưng chỉ là yếu tố phụ đi kèm.`;

        const responseText = await generateWithFallback(prompt);
        res.status(200).json({ answer: responseText });
    } catch (error) {
        console.error('Lỗi askAITutor:', error);
        res.status(500).json({ message: 'Lỗi AI Tutor', detail: (error as Error).message });
    }
};
