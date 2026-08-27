const fs = require('fs');
let code = fs.readFileSync('src/controllers/examController.ts', 'utf8');

// Replace (document_id = $2 OR exam_id = $2) with document_id = $2
code = code.replace(/\(document_id = \$2 OR exam_id = \$2\)/g, "document_id = $2");

// Replace INSERT INTO exam_submissions (document_id, exam_id, student_id, student_answers, time_taken_seconds, status, last_saved_at) VALUES ($1, $1, $2, $3, $4, 'IN_PROGRESS', NOW())
code = code.replace(
    /\(document_id, exam_id, student_id, student_answers,[\s\r\n]*time_taken_seconds, status, last_saved_at\)[\s\r\n]*VALUES \(\$1, \$1, \$2, \$3, \$4, 'IN_PROGRESS', NOW\(\)\)/g,
    "(document_id, student_id, student_answers, time_taken_seconds, status, last_saved_at) VALUES ($1, $2, $3, $4, 'IN_PROGRESS', NOW())"
);

// Replace INSERT INTO exam_submissions (document_id, exam_id, student_id, student_answers, total_score, part1_score, part2_score, part3_score, cheat_count, time_taken_seconds, answers, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'COMPLETED')
code = code.replace(
    /\(document_id, exam_id, student_id, student_answers, total_score, part1_score, part2_score,[\s\r\n]*part3_score, cheat_count, time_taken_seconds, answers, status\)[\s\r\n]*VALUES \(\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, \$9, \$10, \$11, 'COMPLETED'\) RETURNING \*/g,
    "(document_id, student_id, student_answers, total_score, part1_score, part2_score, part3_score, cheat_count, time_taken_seconds, answers, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'COMPLETED') RETURNING *"
);
// And shift the arguments array for that second INSERT:
// [examId, examId, studentId, normalizedAnswersPayload, totalScore, roundedP1Score, roundedP2Score, roundedP3Score, cheatCountNum, timeTakenNum, JSON.stringify(details)]
code = code.replace(
    /\[examId, examId, studentId, normalizedAnswersPayload, totalScore, roundedP1Score, roundedP2Score,[\s\r\n]*roundedP3Score, cheatCountNum, timeTakenNum, JSON\.stringify\(details\)\]/g,
    "[examId, studentId, normalizedAnswersPayload, totalScore, roundedP1Score, roundedP2Score, roundedP3Score, cheatCountNum, timeTakenNum, JSON.stringify(details)]"
);

// Payload for parseExamFromFile
// "Payload trả về phải chứa TẤT CẢ thông tin cần để Preview: { status: 'success', data: { document_id: ..., questions: [...], shared_context: [...] } }"
// Wait, the frontend code in CreateExamAI uses `response.data.examContent`. But the prompt says "BẮT BUỘC trả về HTTP 200. Payload trả về phải chứa TẤT CẢ thông tin cần để Preview: { status: 'success', data: { document_id: ..., questions: [...], shared_context: [...] } }".
const oldParseResponse = /res\.status\(200\)\.json\(\{[\s\S]*?message: 'Phân tích file bằng AI thành công! Vui lòng kiểm tra và chỉnh sửa trước khi lưu\.',[\s\S]*?examKey: \{[\s\S]*?part1_key: part1Key,[\s\S]*?part2_key: part2Key,[\s\S]*?part3_key: part3Key,[\s\S]*?document_id: actual_document_id,[\s\S]*?class_id: class_id,[\s\S]*?duration_minutes: durationMinutes \|\| 50[\s\S]*?\},[\s\S]*?examContent: fullExam[\s\S]*?\}\);/m;

const newParseResponse = `res.status(200).json({ 
    status: 'success',
    data: {
        document_id: actual_document_id,
        class_id: class_id,
        duration_minutes: durationMinutes || 50,
        examKey: { part1_key: part1Key, part2_key: part2Key, part3_key: part3Key },
        examContent: fullExam,
        questions: fullExam, 
        shared_context: fullExam.shared_context || []
    }
});`;

if (code.includes('Phân tích file bằng AI thành công!')) {
    code = code.replace(/res\.status\(200\)\.json\(\{[\s\S]*?Phân tích file bằng AI thành công![\s\S]*?examContent: fullExam\s*\}\);/, newParseResponse);
} else {
    // maybe encoded text
    code = code.replace(/res\.status\(200\)\.json\(\{[\s\S]*?examContent: fullExam\s*\}\);/, newParseResponse);
}

fs.writeFileSync('src/controllers/examController.ts', code);
console.log("Patched examController.ts");
