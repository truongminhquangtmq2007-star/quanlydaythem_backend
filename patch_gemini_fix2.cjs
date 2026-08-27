const fs = require('fs');
let code = fs.readFileSync('src/services/geminiService.ts', 'utf8');

// 1. Remove pdf-parse and mammoth imports
code = code.replace(/const pdfParse = require\('pdf-parse'\);\s*/, '');
code = code.replace(/import mammoth from 'mammoth';\s*/, '');

// 2. Extract out extractTextFromBuffer and chunkText by finding keywords and removing blocks
const idx1 = code.indexOf('async function extractTextFromBuffer');
const idx2 = code.indexOf('export const parseFullExamFromFileWithGemini');
if (idx1 !== -1 && idx2 !== -1 && idx1 < idx2) {
    code = code.substring(0, idx1) + code.substring(idx2);
}

// 3. Rewrite parseFullExamFromFileWithGemini
const idx3 = code.indexOf('export const parseFullExamFromFileWithGemini');
const idx4 = code.indexOf('export async function generateWithFallback');
if (idx3 !== -1 && idx4 !== -1 && idx3 < idx4) {
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
};\n\n`;
    code = code.substring(0, idx3) + newFunction + code.substring(idx4);
}

fs.writeFileSync('src/services/geminiService.ts', code);
console.log("Patched geminiService.ts successfully.");

