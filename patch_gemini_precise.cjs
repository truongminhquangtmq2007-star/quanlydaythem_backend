const fs = require('fs');
let code = fs.readFileSync('src/services/geminiService.ts', 'utf8');

// 1. Remove pdf-parse and mammoth imports
code = code.replace(/const pdfParse = require\('pdf-parse'\);\s*/, '');
code = code.replace(/import mammoth from 'mammoth';\s*/, '');

// 2. We want to remove `extractTextFromBuffer`, `chunkText` and replace `parseFullExamFromFileWithGemini`.
// Let's find exactly where they are.
const startStr = 'async function extractTextFromBuffer(buffer: Buffer, mimetype: string): Promise<string> {';
const endStr = 'export async function generateWithFallback(prompt: string): Promise<string> {';

const startIndex = code.indexOf(startStr);
const endIndex = code.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
    const before = code.substring(0, startIndex);
    const after = code.substring(endIndex);
    
    const newFunction = `export const parseFullExamFromFileWithGemini = async (file: Express.Multer.File): Promise<FullExamData> => {
  const contents = [
    basePrompt,
    {
      inlineData: {
        data: file.buffer.toString('base64'),
        mimeType: file.mimetype,
      },
    },
  ];

  try {
    const text = await callGeminiWithRetry(contents);
    const examData: FullExamData = JSON.parse(text);
    return normalizeExamData(examData);
  } catch (error) {
    console.error('Lỗi khi bóc tách file với Gemini:', error);
    throw error;
  }
};

`;

    code = before + newFunction + after;
} else {
    console.log("Could not find start or end strings.");
}

fs.writeFileSync('src/services/geminiService.ts', code);
console.log("Patched geminiService.ts with precision.");

