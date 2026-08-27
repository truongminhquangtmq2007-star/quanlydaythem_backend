const fs = require('fs');
let code = fs.readFileSync('src/controllers/examController.ts', 'utf8');

// Replace (document_id = $2 OR exam_id = $2) with document_id = $2
code = code.replace(/\(document_id = \$2 OR exam_id = \$2\)/g, "document_id = $2");

// Fix INSERT 1: 
// `INSERT INTO exam_submissions (document_id, exam_id, student_id, student_answers, time_taken_seconds, status, last_saved_at) \n                   VALUES ($1, $1, $2, $3, $4, 'IN_PROGRESS', NOW())`
code = code.replace(
    /\(document_id, exam_id, student_id/g,
    "(document_id, student_id"
);
code = code.replace(
    /VALUES \(\$1, \$1, \$2/g,
    "VALUES ($1, $2, $3"
);
// In that same query, we shifted $2->3, $3->4, $4->5 in string, but actually it's easier to just do string exact replace.
code = code.replace(
    /VALUES \(\$1, \$2, \$3, \$3, \$4, 'IN_PROGRESS', NOW\(\)\)/g, // wait
    "nope"
);

// Actually, I can just replace `exam_id, ` with nothing in the columns, and `$1, ` or `$2, ` in VALUES.
// Let's do it manually via regex:
code = code.replace(
    /INSERT INTO exam_submissions \(document_id, exam_id, student_id, student_answers, \r?\n?time_taken_seconds, status, last_saved_at\) \r?\n?\s*VALUES \(\$1, \$1, \$2, \$3, \$4, 'IN_PROGRESS', NOW\(\)\)/g,
    "INSERT INTO exam_submissions (document_id, student_id, student_answers, time_taken_seconds, status, last_saved_at) VALUES ($1, $2, $3, $4, 'IN_PROGRESS', NOW())"
);

// Fix INSERT 2:
code = code.replace(
    /INSERT INTO exam_submissions \r?\n?\s*\(document_id, exam_id, student_id, student_answers, total_score, part1_score, part2_score, \r?\n?\s*part3_score, cheat_count, time_taken_seconds, answers, status\) \r?\n?\s*VALUES \(\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, \$9, \$10, \$11, 'COMPLETED'\) RETURNING \*/g,
    "INSERT INTO exam_submissions (document_id, student_id, student_answers, total_score, part1_score, part2_score, part3_score, cheat_count, time_taken_seconds, answers, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'COMPLETED') RETURNING *"
);

// Fix arguments array for INSERT 2
code = code.replace(
    /\[examId, examId, studentId, normalizedAnswersPayload, totalScore, roundedP1Score, roundedP2Score, \r?\n?\s*roundedP3Score, cheatCountNum, timeTakenNum, JSON\.stringify\(details\)\]/g,
    "[examId, studentId, normalizedAnswersPayload, totalScore, roundedP1Score, roundedP2Score, roundedP3Score, cheatCountNum, timeTakenNum, JSON.stringify(details)]"
);


fs.writeFileSync('src/controllers/examController.ts', code);
console.log("Patched DB columns");

