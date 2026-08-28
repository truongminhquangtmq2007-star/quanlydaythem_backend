const fs = require('fs');
let code = fs.readFileSync('src/controllers/examController.ts', 'utf8');

const regex = /const folderCheck = await pool\.query\("SELECT id FROM folders WHERE class_id = \\\$1 AND category = 'EXAM'", \[class_id\]\);\s*if \(folderCheck\.rows\.length > 0\) \{\s*folderId = folderCheck\.rows\[0\]\.id;\s*\}/u;

const replaceWith = `const folderCheck = await pool.query("SELECT id FROM folders WHERE class_id = $1 AND category = 'EXAM'", [class_id]);
            if (folderCheck.rows.length > 0) {
                folderId = folderCheck.rows[0].id;
            } else {
                const newFolder = await pool.query(
                    "INSERT INTO folders (name, category, class_id, teacher_id) VALUES ('Đề thi', 'EXAM', $1, $2) RETURNING id",
                    [class_id, req.user?.id || null]
                );
                folderId = newFolder.rows[0].id;
            }`;

if (code.match(regex)) {
    // Note: the regex matches multiple occurrences. We only want to replace the one in publishExam.
    // Let's use string replace but carefully.
}

