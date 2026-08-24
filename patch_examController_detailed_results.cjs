const fs = require('fs');
let code = fs.readFileSync('src/controllers/examController.ts', 'utf8');

code = code.replace(/detailed_results = \$8/g, "answers = $8");
code = code.replace(/time_taken_seconds, detailed_results, status/g, "time_taken_seconds, answers, status");
code = code.replace(/es\.detailed_results,/g, "es.answers AS detailed_results,");
code = code.replace(/student_answers, detailed_results FROM/g, "student_answers, answers AS detailed_results FROM");

fs.writeFileSync('src/controllers/examController.ts', code);
console.log('Fixed detailed_results');

