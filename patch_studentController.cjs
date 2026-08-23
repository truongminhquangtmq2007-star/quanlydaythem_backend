const fs = require('fs');

let code = fs.readFileSync('src/controllers/studentController.ts', 'utf8');

const regex = /const studentRes = await pool\.query\('SELECT id, full_name, phone_number AS phone, parent_phone, school, grade, \\ncurrent_level, status, learning_goals FROM students WHERE id = \$1', \[id\]\);/g;

// Fallback search if exact formatting varies
code = code.replace(
  /const studentRes = await pool\.query\('SELECT .*? FROM students WHERE id = \$1', \[id\]\);/g,
  "const studentRes = await pool.query('SELECT id, full_name, phone_number AS phone, school_name AS school, is_active AS status, learning_goals, COALESCE(ai_evaluation, \\'null\\'::jsonb) AS ai_evaluation FROM students WHERE id = $1', [id]);"
);

// Add the catch error logging
code = code.replace(
  /console\.error\(error\);\s*res\.status\(500\)\.json\(\{ message: "Lỗi server" \}\);/g,
  "console.error('Lỗi get profile360:', error);\n      res.status(500).json({ message: 'Lỗi server' });"
);

fs.writeFileSync('src/controllers/studentController.ts', code);
console.log('Patched studentController.ts');

