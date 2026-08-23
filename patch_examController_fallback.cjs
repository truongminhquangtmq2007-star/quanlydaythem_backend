const fs = require('fs');
let code = fs.readFileSync('src/controllers/examController.ts', 'utf8');

if (!code.includes('generateWithFallback')) {
  // 1. Add import
  code = code.replace(
    /import \{ extractExamWithAI, parsePDFBuffer \} from '\.\.\/services\/geminiService';/,
    "import { extractExamWithAI, parsePDFBuffer, generateWithFallback } from '../services/geminiService';"
  );
  
  // 2. Replace SDK usage
  code = code.replace(
    /const response = await ai\.models\.generateContent\(\{\s*model: MODEL_FALLBACK_CHAIN,\s*contents: prompt,\s*\}\);\s*res\.status\(200\)\.json\(\{ answer: response\.text \}\);/m,
    "const responseText = await generateWithFallback(prompt);\n        res.status(200).json({ answer: responseText });"
  );
  
  // also clean up any unused ai from 'GoogleGenAI' if present
  // but we can leave it for now.
  fs.writeFileSync('src/controllers/examController.ts', code);
  console.log('Patched examController.ts');
} else {
  console.log('Already patched');
}

