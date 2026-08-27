const fs = require('fs');
let code = fs.readFileSync('src/services/geminiService.ts', 'utf8');

// 1. Remove pdf-parse and mammoth imports
code = code.replace(/const pdfParse = require\('pdf-parse'\);\s*/, '');
code = code.replace(/import mammoth from 'mammoth';\s*/, '');

// 2. Remove extractTextFromBuffer and chunkText completely
const extractTextRegex = /async function extractTextFromBuffer[\s\S]*?function chunkText[\s\S]*?return chunks;\n\}/;
code = code.replace(extractTextRegex, '');

// 3. Rewrite parseFullExamFromFileWithGemini
const oldFunction = /export const parseFullExamFromFileWithGemini = async \(file: Express\.Multer\.File\): Promise<FullExamData> => \{[\s\S]*?^\};\n/m;

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

code = code.replace(oldFunction, newFunction);

fs.writeFileSync('src/services/geminiService.ts', code);
console.log("Patched geminiService.ts successfully.");
