const fs = require('fs');
let code = fs.readFileSync('src/services/geminiService.ts', 'utf8');

// 1. Remove pdf-parse and mammoth imports
code = code.replace(/const pdfParse = require\('pdf-parse'\);\s*/, '');
code = code.replace(/import mammoth from 'mammoth';\s*/, '');

// 2. Safely remove extractTextFromBuffer
const extractStart = code.indexOf('async function extractTextFromBuffer');
const chunkStart = code.indexOf('function chunkText');
const parseFileStart = code.indexOf('export const parseFullExamFromFileWithGemini');

if (extractStart !== -1 && parseFileStart !== -1) {
    code = code.substring(0, extractStart) + code.substring(parseFileStart);
}

// 3. Rewrite parseFullExamFromFileWithGemini
const oldFunctionRegex = /export const parseFullExamFromFileWithGemini = async \(file: Express\.Multer\.File\): Promise<FullExamData> => \{[\s\S]*?^\};\n/m;

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

code = code.replace(oldFunctionRegex, newFunction);

fs.writeFileSync('src/services/geminiService.ts', code);
console.log("Patched geminiService.ts carefully.");
