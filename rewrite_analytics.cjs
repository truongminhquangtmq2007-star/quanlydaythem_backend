const fs = require('fs');

const file = 'src/controllers/examController.ts';
let code = fs.readFileSync(file, 'utf8');

const regex = /\/\/ ==+\s*\/\/ PHASE 5:[\s\S]*?catch \(analyticsErr\) {[\s\S]*?}/;

const newCode = `// ========================================================
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
              console.error('Lỗi tính toán Analytics:', analyticsErr);
              res.status(500).json({ message: 'Lỗi server khi nộp bài thi', detail: (analyticsErr as Error).message });
              return;
          } finally {
              client.release();
          }`;

code = code.replace(regex, newCode);
fs.writeFileSync(file, code);
console.log('Analytics rewritten!');

