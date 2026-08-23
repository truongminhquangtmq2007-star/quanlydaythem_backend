const fs = require('fs');
let code = fs.readFileSync('src/controllers/examController.ts', 'utf8');

if (!code.includes('import { generateWithFallback }')) {
  code = "import { generateWithFallback } from '../services/geminiService';\n" + code;
  fs.writeFileSync('src/controllers/examController.ts', code);
  console.log('Added import');
}

