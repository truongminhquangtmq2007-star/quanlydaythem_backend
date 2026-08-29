const fs = require('fs');
const file = 'src/controllers/examController.ts';
let code = fs.readFileSync(file, 'utf8');

// The block starts right after `const normalizedAnswersPayload = ...`
const regex = /const normalizedAnswersPayload = \{[\s\S]*?part3: p3Answers\s*\};[\s\S]*?return;\s*\}\s*finally\s*\{\s*client\.release\(\);\s*\}/;

const replacement = `const normalizedAnswersPayload = {
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
                \`SELECT id, is_performance_aggregated, total_score, part1_score, part2_score, part3_score, cheat_count, time_taken_seconds, answers 
                 FROM exam_submissions 
                 WHERE student_id = $1 AND document_id = $2 AND status = 'COMPLETED' 
                 AND submitted_at > NOW() - INTERVAL '10 seconds'
                 ORDER BY submitted_at DESC LIMIT 1\`,
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
                \`SELECT id, is_performance_aggregated FROM exam_submissions WHERE student_id = $1 AND document_id = $2 AND status = 'IN_PROGRESS' FOR UPDATE\`,
                [studentId, examId]
            );

            if (existDraft.rows.length > 0) {
                submitResult = await client.query(
                    \`UPDATE exam_submissions 
                     SET student_answers = $1, total_score = $2, part1_score = $3, part2_score = $4, part3_score = $5, 
                         cheat_count = $6, time_taken_seconds = $7, answers = $8, status = 'COMPLETED', submitted_at = NOW()
                     WHERE id = $9 RETURNING *\`,
                    [normalizedAnswersPayload, totalScore, roundedP1Score, roundedP2Score, roundedP3Score, cheatCountNum, timeTakenNum, JSON.stringify(details), existDraft.rows[0].id]
                );
            } else {
                submitResult = await client.query(
                    \`INSERT INTO exam_submissions (document_id, student_id, student_answers, total_score, part1_score, part2_score, part3_score, cheat_count, time_taken_seconds, answers, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'COMPLETED') RETURNING *\`,
                    [examId, studentId, normalizedAnswersPayload, totalScore, roundedP1Score, roundedP2Score, roundedP3Score, cheatCountNum, timeTakenNum, JSON.stringify(details)]
                );
            }

            // ========================================================
            // PHASE 5: TÍNH TOÁN HIỆU SUẤT THEO CHUYÊN ĐỀ (ANALYTICS)
            // ========================================================
            const examContent = answerKey.exam_content || {};
            const allQuestions = [
                ...(examContent.part1 || []),
                ...(examContent.part2 || []),
                ...(examContent.part3 || [])
            ];

            // Gom nhóm hiệu suất theo topic trong bài làm này
            const topicPerformance = {};
            
            for (const detail of details) {
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

            if (!submitResult.rows[0].is_performance_aggregated) {
                // Upsert vào bảng student_topic_performance
                for (const [topic, stats] of Object.entries(topicPerformance)) {
                    await client.query(
                        \`INSERT INTO student_topic_performance (student_id, topic_name, total_questions, correct_answers, accuracy_rate)
                         VALUES ($1, $2, $3, $4, $5)
                         ON CONFLICT (student_id, topic_name) DO UPDATE SET 
                            total_questions = student_topic_performance.total_questions + EXCLUDED.total_questions,
                            correct_answers = student_topic_performance.correct_answers + EXCLUDED.correct_answers,
                            accuracy_rate = CASE 
                              WHEN (student_topic_performance.total_questions + EXCLUDED.total_questions) > 0 
                              THEN ROUND(CAST((student_topic_performance.correct_answers + EXCLUDED.correct_answers) AS NUMERIC) * 100.0 / (student_topic_performance.total_questions + EXCLUDED.total_questions), 2)
                              ELSE 0
                            END,
                            last_updated = CURRENT_TIMESTAMP\`,
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
                const topicPerformanceJsonb = {};
                for (const [topic, stats] of Object.entries(topicPerformance)) {
                    topicPerformanceJsonb[topic] = { correct: stats.corrects, total: stats.attempts };
                }
                
                await client.query(
                    \`UPDATE exam_submissions SET topic_performance = $1, is_performance_aggregated = TRUE WHERE id = $2\`,
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
        }`;

code = code.replace(regex, replacement);
fs.writeFileSync(file, code);
console.log('Fixed examController.ts completely!');

