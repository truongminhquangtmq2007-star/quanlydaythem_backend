const fs = require('fs');
let code = fs.readFileSync('src/controllers/examController.ts', 'utf8');

// Find the start of the `catch (aiError: any)` block
const tryAIEndIndex = code.indexOf(`catch (aiError: any) {`);
// Find the end of `parseExamFromFile` (the catch error: any block)
const parseExamEndIndex = code.indexOf(`} catch (error: any) {`, tryAIEndIndex);

if (tryAIEndIndex !== -1 && parseExamEndIndex !== -1) {
    let before = code.substring(0, tryAIEndIndex);
    let after = code.substring(parseExamEndIndex);
    
    // We will inject the new logic inside the try-catch for AI and the questions insert.
    let newLogic = `catch (aiError: any) {
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

        res.status(200).json({ status: 'success', data: resultData });
    `;

    code = before + newLogic + after;
    fs.writeFileSync('src/controllers/examController.ts', code);
    console.log("Patched parseExamFromFile with questions insert");
} else {
    console.log("Could not find blocks");
}

