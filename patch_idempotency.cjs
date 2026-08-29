const fs = require('fs');

const file = 'src/controllers/examController.ts';
let code = fs.readFileSync(file, 'utf8');

const oldCheck = `            // Lưu kết quả nộp bài vào bảng exam_submissions
            const existDraft = await client.query(
                \`SELECT id, is_performance_aggregated FROM exam_submissions WHERE student_id = $1 AND document_id = $2 AND status = 'IN_PROGRESS' FOR UPDATE\`,
                [studentId, examId]
            );`;

const newCheck = `            // KIỂM TRA IDEMPOTENCY (CHỐNG DOUBLE-CLICK / RETRY)
            // Nếu có 1 bài đã nộp (COMPLETED) trong vòng 10 giây qua, coi như là request trùng lặp.
            const recentSubmit = await client.query(
                \`SELECT id, is_performance_aggregated, total_score, part1_score, part2_score, part3_score, cheat_count, time_taken_seconds, answers 
                 FROM exam_submissions 
                 WHERE student_id = $1 AND document_id = $2 AND status = 'COMPLETED' 
                 AND submitted_at > NOW() - INTERVAL '10 seconds'
                 ORDER BY submitted_at DESC LIMIT 1\`,
                [studentId, examId]
            );

            if (recentSubmit.rows.length > 0) {
                // Trả về kết quả của submission trước đó luôn, không làm gì thêm
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
                \`SELECT id, is_performance_aggregated FROM exam_submissions WHERE student_id = $1 AND document_id = $2 AND status = 'IN_PROGRESS' FOR UPDATE\`,
                [studentId, examId]
            );`;

code = code.replace(oldCheck, newCheck);
fs.writeFileSync(file, code);
console.log('Idempotency patched!');

