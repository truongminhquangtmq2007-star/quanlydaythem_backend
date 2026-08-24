const fs = require('fs');
let code = fs.readFileSync('src/controllers/examController.ts', 'utf8');

// Remove ensureExamSubmissionsTable
code = code.replace(/const ensureExamSubmissionsTable = async \(\) => \{[\s\S]*?\};\s*/, '');
// Remove call to ensureExamSubmissionsTable
code = code.replace(/await ensureExamSubmissionsTable\(\);\s*/g, '');

// Remove CREATE TABLE question_contexts
code = code.replace(/\/\/ Tự động tạo bảng question_contexts nếu chưa tồn tại\s*await pool\.query\(`\s*CREATE TABLE IF NOT EXISTS question_contexts \([\s\S]*?\);\s*`\);\s*/g, '');
code = code.replace(/\/\/ T Tng to bng question_contexts nu cha t"n ti\s*await pool\.query\(`\s*CREATE TABLE IF NOT EXISTS question_contexts \([\s\S]*?\);\s*`\);\s*/g, '');

// Wait, the regex might fail due to encoding. Let's just remove ANY CREATE TABLE and ALTER TABLE pool.query calls.
code = code.replace(/await pool\.query\(`\s*CREATE TABLE IF NOT EXISTS question_contexts[\s\S]*?`\);/g, '');
code = code.replace(/await pool\.query\(`\s*CREATE TABLE IF NOT EXISTS exam_submissions[\s\S]*?`\);/g, '');
code = code.replace(/await pool\.query\(`\s*ALTER TABLE exam_keys ADD COLUMN IF NOT EXISTS context_id[\s\S]*?`\);/g, '');
code = code.replace(/try \{ await pool\.query\(`ALTER TABLE exam_submissions ADD COLUMN IF NOT EXISTS.*?`\); \} catch\(e\)\{\}/g, '');
code = code.replace(/try \{\s*await pool\.query\(`ALTER TABLE exam_submissions ADD COLUMN IF NOT EXISTS.*?`\);\s*await pool\.query\(`ALTER TABLE exam_submissions ADD COLUMN IF NOT EXISTS.*?`\);\s*await pool\.query\(`ALTER TABLE exam_submissions ADD COLUMN IF NOT EXISTS.*?`\);\s*\} catch \(colErr\) \{\}/g, '');

fs.writeFileSync('src/controllers/examController.ts', code);
console.log('Cleaned up DDL statements');
