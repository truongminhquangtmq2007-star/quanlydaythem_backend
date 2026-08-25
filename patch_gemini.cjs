const fs = require('fs');
let code = fs.readFileSync('src/services/geminiService.ts', 'utf8');

code = code.replace(
`const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});`,
`const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: { timeout: 90000 }
});`
);

fs.writeFileSync('src/services/geminiService.ts', code);
console.log('Patched GoogleGenAI');

