const fs = require('fs');
let code = fs.readFileSync('src/controllers/examController.ts', 'utf8');

const oldLoop = /for\s*\(\s*const\s*q\s*of\s*allQuestions\s*\)\s*\{\s*await\s*pool\.query\(\s*`INSERT INTO questions \(quiz_id, part_number, question_type, content, answer_data\) VALUES \(\$1, \$2, \$3, \$4, \$5\)`,\s*\[actual_document_id,\s*q\.part_number,\s*q\.question_type,\s*JSON\.stringify\(q\),\s*JSON\.stringify\(q\.correctAnswer\)\]\s*\);\s*\}/;

const newLoop = `await Promise.all(allQuestions.map(q => 
                pool.query(
                    \`INSERT INTO questions (quiz_id, part_number, question_type, content, answer_data) VALUES ($1, $2, $3, $4, $5)\`,
                    [actual_document_id, q.part_number, q.question_type, JSON.stringify(q), JSON.stringify(q.correctAnswer)]
                )
            ));`;

if (code.match(oldLoop)) {
    code = code.replace(oldLoop, newLoop);
    fs.writeFileSync('src/controllers/examController.ts', code);
    console.log("Optimized db inserts");
} else {
    console.log("Failed to match regex for loop patch");
}

