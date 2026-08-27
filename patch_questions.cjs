const fs = require('fs');
let code = fs.readFileSync('src/controllers/examController.ts', 'utf8');

// I will find the `res.status(200).json({ status: 'success', ... })` inside parseExamFromFile
// and replace it with the new insertion logic.

const oldSuccessRes = `res.status(200).json({ 
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

const newLogic = `
        try {
            const allQuestions = [
                ...(fullExam.part1 || []).map((q: any) => ({ ...q, part_number: 1, question_type: 'MULTIPLE_CHOICE' })),
                ...(fullExam.part2 || []).map((q: any) => ({ ...q, part_number: 2, question_type: 'TRUE_FALSE' })),
                ...(fullExam.part3 || []).map((q: any) => ({ ...q, part_number: 3, question_type: 'SHORT_ANSWER' }))
            ];

            for (const q of allQuestions) {
                await pool.query(
                    \`INSERT INTO questions (quiz_id, part_number, question_type, content, answer_data) VALUES ($1, $2, $3, $4, $5)\`,
                    [
                        actual_document_id,
                        q.part_number,
                        q.question_type,
                        JSON.stringify(q),
                        JSON.stringify(q.correctAnswer || q.correct_answer || null)
                    ]
                );
            }
        } catch (error: any) {
            return res.status(500).json({ message: "Lỗi lưu cơ sở dữ liệu: " + error.message });
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
        
        return res.status(200).json({ status: 'success', data: resultData });`;

function escapeRegExp(string) {
  return string.replace(/[.*+?^$\{\}\(\)\|\[\]\\]/g, '\\$&');
}
function flexibleRegex(string) {
    return new RegExp(escapeRegExp(string).replace(/\\\s+/g, '\\s+'), 'g');
}

if (code.match(flexibleRegex(oldSuccessRes))) {
    code = code.replace(flexibleRegex(oldSuccessRes), newLogic);
    fs.writeFileSync('src/controllers/examController.ts', code);
    console.log("Patched parseExamFromFile to insert into questions");
} else {
    console.log("Could not find the old success response block!");
}
