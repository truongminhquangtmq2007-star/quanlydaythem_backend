const fs = require('fs');

const code = fs.readFileSync('src/controllers/examController.ts', 'utf8');

let newCode = code.replace(
    /INSERT INTO documents \(title, category, folder_id, duration_minutes, teacher_id\)\s+VALUES \(\$1, 'EXAM', \$2, \$3, \$4\)/g,
    `INSERT INTO documents (title, category, folder_id, teacher_id) \n                 VALUES ($1, 'EXAM', $2, $3)`
);

// We also need to fix the array passed to it:
// [title || 'Đề thi AI', folderId, duration_minutes, req.user?.id || null]
// becomes: [title || 'Đề thi AI', folderId, req.user?.id || null]
newCode = newCode.replace(
    /\[title \|\| 'Đề thi AI', folderId, duration_minutes, req\.user\?\.id \|\| null\]/g,
    `[title || 'Đề thi AI', folderId, req.user?.id || null]`
);

// And the UPDATE query:
// UPDATE documents SET title = $1, folder_id = $2, duration_minutes = $3 WHERE id = $4
newCode = newCode.replace(
    /UPDATE documents SET title = \$1, folder_id = \$2, duration_minutes = \$3 WHERE id = \$4/g,
    `UPDATE documents SET title = $1, folder_id = $2 WHERE id = $3`
);

// And its array:
// [title, folderId, duration_minutes, actual_document_id]
newCode = newCode.replace(
    /\[title, folderId, duration_minutes, actual_document_id\]/g,
    `[title, folderId, actual_document_id]`
);

fs.writeFileSync('src/controllers/examController.ts', newCode);
console.log("Patched documents query in examController.ts");

