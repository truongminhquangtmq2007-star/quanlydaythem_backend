const fs = require('fs');
let code = fs.readFileSync('src/controllers/examController.ts', 'utf8');

// 1. Fix DB Columns
code = code.replace(/\(document_id = \$2 OR exam_id = \$2\)/g, "document_id = $2");

code = code.replace(
    /INSERT INTO exam_submissions \(document_id, exam_id, student_id, student_answers, \r?\n?\s*time_taken_seconds, status, last_saved_at\) \r?\n?\s*VALUES \(\$1, \$1, \$2, \$3, \$4, 'IN_PROGRESS', NOW\(\)\)/g,
    "INSERT INTO exam_submissions (document_id, student_id, student_answers, time_taken_seconds, status, last_saved_at) VALUES ($1, $2, $3, $4, 'IN_PROGRESS', NOW())"
);

code = code.replace(
    /INSERT INTO exam_submissions \r?\n?\s*\(document_id, exam_id, student_id, student_answers, total_score, part1_score, part2_score, \r?\n?\s*part3_score, cheat_count, time_taken_seconds, answers, status\) \r?\n?\s*VALUES \(\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, \$9, \$10, \$11, 'COMPLETED'\) RETURNING \*/g,
    "INSERT INTO exam_submissions (document_id, student_id, student_answers, total_score, part1_score, part2_score, part3_score, cheat_count, time_taken_seconds, answers, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'COMPLETED') RETURNING *"
);

code = code.replace(
    /\[examId, examId, studentId, normalizedAnswersPayload, totalScore, roundedP1Score, roundedP2Score, \r?\n?\s*roundedP3Score, cheatCountNum, timeTakenNum, JSON\.stringify\(details\)\]/g,
    "[examId, studentId, normalizedAnswersPayload, totalScore, roundedP1Score, roundedP2Score, roundedP3Score, cheatCountNum, timeTakenNum, JSON.stringify(details)]"
);

// 2. Fix parseExamFromFile JSON response
// First response (aiError catch):
const oldFailRes = `res.status(200).json({ 
                message: 'Lưu đề thi thành công! (Lưu ý: AI bóc tách thất bại do quá tải, vui lòng nhập câu hỏi thủ công)',
                examKey: {
                    part1_key: {},
                    part2_key: {},
                    part3_key: {},
                    document_id: actual_document_id,
                    class_id: class_id,
                    duration_minutes: durationMinutes || 50
                },
                examContent: { part1: [], part2: [], part3: [] }
            });`;
const newFailRes = `res.status(200).json({ 
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
            });`;

// Second response (success):
const oldSuccRes = `res.status(200).json({ 
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
        });`;
const newSuccRes = `res.status(200).json({ 
            status: 'success',
            message: 'Phân tích file bằng AI thành công! Vui lòng kiểm tra và chỉnh sửa trước khi lưu.',
            data: {
                document_id: actual_document_id,
                class_id: class_id,
                duration_minutes: durationMinutes || 50,
                examKey: { part1_key: part1Key, part2_key: part2Key, part3_key: part3Key },
                examContent: fullExam,
                questions: fullExam,
                shared_context: fullExam?.shared_context || []
            }
        });`;

function escapeRegExp(string) {
  return string.replace(/[.*+?^$\{\}\(\)\|\[\]\\]/g, '\\$&');
}

// Convert string to match any whitespace
function flexibleRegex(string) {
    return new RegExp(escapeRegExp(string).replace(/\\\s+/g, '\\s+'), 'g');
}

code = code.replace(flexibleRegex(oldFailRes), newFailRes);
code = code.replace(flexibleRegex(oldSuccRes), newSuccRes);

fs.writeFileSync('src/controllers/examController.ts', code);
console.log("Patched safely using exact flexible whitespace string matching");

