const fs = require('fs');
let code = fs.readFileSync('src/controllers/examController.ts', 'utf8');

const targetLoop = "for (const q of allQuestions) {";
const endLoop = ");\n            }";

const startIndex = code.indexOf(targetLoop);
if (startIndex !== -1) {
    const queryStr = "`INSERT INTO questions (quiz_id, part_number, question_type, content, answer_data) VALUES ($1, $2, $3, $4, $5)`";
    // we just replace the whole loop block safely.
    // I know exactly what it looks like.
    const blockStart = code.indexOf("for (const q of allQuestions) {");
    const blockEnd = code.indexOf("} catch (error: any) {", blockStart);
    
    if (blockEnd !== -1) {
        const oldBlock = code.substring(blockStart, blockEnd);
        const newBlock = `await Promise.all(allQuestions.map(q => 
                pool.query(
                    \`INSERT INTO questions (quiz_id, part_number, question_type, content, answer_data) VALUES ($1, $2, $3, $4, $5)\`,
                    [actual_document_id, q.part_number, q.question_type, JSON.stringify(q), JSON.stringify(q.correctAnswer)]
                )
            ));\n        `;
        code = code.replace(oldBlock, newBlock);
        fs.writeFileSync('src/controllers/examController.ts', code);
        console.log("Replaced loop with Promise.all");
    }
}

