const fs = require('fs');
let code = fs.readFileSync('src/services/geminiService.ts', 'utf8');

const missingHeader = `import { TAXONOMIES } from '../constants/taxonomies';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: { timeout: 90000 }
});

`;

if (!code.includes('const ai = new GoogleGenAI')) {
    code = code.replace(`import { GoogleGenAI, Type } from '@google/genai';\nexport interface MultipleChoiceQuestion {`, `import { GoogleGenAI, Type } from '@google/genai';\n${missingHeader}export interface MultipleChoiceQuestion {`);
    
    // In case the newline matching is slightly different
    code = code.replace(`import { GoogleGenAI, Type } from '@google/genai';\r\nexport interface MultipleChoiceQuestion {`, `import { GoogleGenAI, Type } from '@google/genai';\r\n${missingHeader}export interface MultipleChoiceQuestion {`);
}

fs.writeFileSync('src/services/geminiService.ts', code);
console.log('Restored top of geminiService');

