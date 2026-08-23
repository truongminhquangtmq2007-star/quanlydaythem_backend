const fs = require('fs');
let code = fs.readFileSync('src/controllers/examController.ts', 'utf8');

// Replace the INSERT query
code = code.replace(
  /INSERT INTO exam_keys \(document_id, class_id, part1_key, part2_key, part3_key, allow_view_answers, duration_minutes, exam_content, context_id\)\s*VALUES \(\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, \$9\)\s*ON CONFLICT \(document_id\)\s*DO UPDATE SET\s*part1_key = \$3, part2_key = \$4, part3_key = \$5,\s*allow_view_answers = \$6, duration_minutes = \$7, exam_content = \$8, context_id = \$9\s*RETURNING \*/,
  `INSERT INTO exam_keys (document_id, class_id, part1_key, part2_key, part3_key, allow_view_answers, duration_minutes, exam_content) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
             ON CONFLICT (document_id) 
             DO UPDATE SET 
                part1_key = $3, part2_key = $4, part3_key = $5,
                allow_view_answers = $6, duration_minutes = $7, exam_content = $8
             RETURNING *`
);

// Also we need to modify the array to pass 8 arguments, not 9
code = code.replace(
  /\[\s*document_id,\s*class_id,\s*p1,\s*p2,\s*p3,\s*allow_view_answers,\s*duration_minutes,\s*resolvedExamContent,\s*primaryContextId\s*\]/,
  `[
                document_id,
                class_id,
                p1,
                p2,
                p3,
                allow_view_answers,
                duration_minutes,
                resolvedExamContent
            ]`
);

// We should also modify getExamSubmissions to use students s
code = code.replace(
  /JOIN users u ON es\.student_id = u\.id/g,
  `JOIN students s ON es.student_id = s.id`
);

code = code.replace(
  /u\.username as student_name/g,
  `s.full_name as student_name`
);

fs.writeFileSync('src/controllers/examController.ts', code);
console.log('Fixed examController insert and joins');

