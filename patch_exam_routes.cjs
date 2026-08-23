const fs = require('fs');
let code = fs.readFileSync('src/routes/examRoutes.ts', 'utf8');

if (!code.includes('askAITutor')) {
  code = code.replace(/import \{([\s\S]*?)getExamKey,/, "import {$1getExamKey,\n    askAITutor,");
  code += "\n// Gia sư AI giải đáp thắc mắc\nrouter.post('/ask-tutor', verifyToken, askAITutor);\n";
  fs.writeFileSync('src/routes/examRoutes.ts', code);
  console.log('Patched examRoutes.ts');
} else {
  console.log('Already patched');
}

