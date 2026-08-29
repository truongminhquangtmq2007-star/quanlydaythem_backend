const fs = require('fs');

const file = 'src/controllers/examController.ts';
let code = fs.readFileSync(file, 'utf8');

// Replace DB save part
const oldSaveDb = `        // Lưu kết quả nộp bài vào bảng exam_submissions
        const existDraft = await pool.query(
            \`SELECT id FROM exam_submissions WHERE student_id = $1 AND document_id = $2 AND status = 'IN_PROGRESS'\`,
            [studentId, examId]
        );

        let submitResult;
        if (existDraft.rows.length > 0) {
            submitResult = await pool.query(
                \`UPDATE exam_submissions 
                 SET student_answers = $1, total_score = $2, part1_score = $3, part2_score = $4, part3_score = $5, 
                     cheat_count = $6, time_taken_seconds = $7, answers = $8, status = 'COMPLETED', submitted_at = NOW()
                 WHERE id = $9 RETURNING *\`,
                [normalizedAnswersPayload, totalScore, roundedP1Score, roundedP2Score, roundedP3Score, cheatCountNum, timeTakenNum, JSON.stringify(details), existDraft.rows[0].id]
            );
        } else {
            submitResult = await pool.query(
                \`INSERT INTO exam_submissions (document_id, student_id, student_answers, total_score, part1_score, part2_score, part3_score, cheat_count, time_taken_seconds, answers, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'COMPLETED') RETURNING *\`,
                [examId, studentId, normalizedAnswersPayload, totalScore, roundedP1Score, roundedP2Score, roundedP3Score, cheatCountNum, timeTakenNum, JSON.stringify(details)]
            );
        }`;

const newSaveDb = `        const client = await pool.connect();
        let submitResult;
        try {
            await client.query('BEGIN');
            
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
            }`;

code = code.replace(oldSaveDb, newSaveDb);


const oldAnalytics = `            // Upsert vào bảng student_topic_performance
            for (const [topic, stats] of Object.entries(topicPerformance)) {
                await pool.query(
                    \`INSERT INTO student_topic_performance (student_id, topic, attempt_count, correct_count, accuracy_rate)
                     VALUES ($1, $2, $3, $4, $5)
                     ON CONFLICT (student_id, topic) DO UPDATE SET 
                        attempt_count = student_topic_performance.attempt_count + EXCLUDED.attempt_count,
                        correct_count = student_topic_performance.correct_count + EXCLUDED.correct_count,
                        accuracy_rate = ROUND(CAST((student_topic_performance.correct_count + EXCLUDED.correct_count) AS NUMERIC) * 100.0 / (student_topic_performance.attempt_count + EXCLUDED.attempt_count), 2),
                        last_updated = CURRENT_TIMESTAMP\`,
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
                    \`UPDATE exam_submissions SET topic_performance = $1 WHERE id = $2\`,
                    [JSON.stringify(topicPerformanceJsonb), submitResult.rows[0].id]
                );
            }
        } catch (analyticsErr) {
            console.error('Lỗi tính toán Analytics:', analyticsErr);
            // Không block luồng nộp bài nếu lỗi analytics
        }`;


const newAnalytics = `            if (!submitResult.rows[0].is_performance_aggregated) {
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
                const topicPerformanceJsonb: Record<string, { correct: number; total: number }> = {};
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
            res.status(500).json({ message: 'Lỗi server khi nộp bài thi', detail: (analyticsErr as Error).message });
            return;
        } finally {
            client.release();
        }`;

code = code.replace(oldAnalytics, newAnalytics);
fs.writeFileSync(file, code);
console.log('Done replacing!');
