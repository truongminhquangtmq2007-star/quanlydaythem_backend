const fs = require('fs');
let code = fs.readFileSync('src/controllers/studentPortalController.ts', 'utf8');

code = code.replace(
  /"SELECT id, full_name, phone_number AS phone, school_name AS school FROM students WHERE id = \$1"/,
  "\"SELECT id, full_name, phone_number AS phone, school_name AS school, COALESCE(ai_evaluation, 'null'::jsonb) AS ai_evaluation FROM students WHERE id = $1\""
);

fs.writeFileSync('src/controllers/studentPortalController.ts', code);
console.log('Patched studentPortalController.ts');

