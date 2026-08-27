const fs = require('fs');
let code = fs.readFileSync('src/controllers/examController.ts', 'utf8');

const parseExamStart = code.indexOf('export const parseExamFromFile');
const parseExamEnd = code.indexOf('export const getAllExams', parseExamStart);

if (parseExamStart !== -1 && parseExamEnd !== -1) {
    let funcBody = code.substring(parseExamStart, parseExamEnd);
    
    // Replace the first return (catch aiError)
    const oldReturn1Regex = /res\.status\(200\)\.json\(\{[\s\S]*?examContent: \{ part1: \[\], part2: \[\], part3: \[\] \}\s*\}\);/;
    const newReturn1 = `res.status(200).json({ 
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
    funcBody = funcBody.replace(oldReturn1Regex, newReturn1);

    // Replace the second return (success)
    const oldReturn2Regex = /res\.status\(200\)\.json\(\{[\s\S]*?examContent: fullExam\s*\}\);/;
    const newReturn2 = `res.status(200).json({ 
            status: 'success',
            message: 'Phân tích file bằng AI thành công! Vui lòng kiểm tra và chỉnh sửa trước khi lưu.',
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
    funcBody = funcBody.replace(oldReturn2Regex, newReturn2);

    code = code.substring(0, parseExamStart) + funcBody + code.substring(parseExamEnd);
    fs.writeFileSync('src/controllers/examController.ts', code);
    console.log("Patched response payloads in parseExamFromFile");
} else {
    console.log("Could not find parseExamFromFile");
}

