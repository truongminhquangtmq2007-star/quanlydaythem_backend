const fs = require('fs');
let code = fs.readFileSync('src/services/geminiService.ts', 'utf8');

// 1. Remove pdf-parse and mammoth imports
code = code.replace(/const pdfParse = require\('pdf-parse'\);\r?\n?/g, '');
code = code.replace(/import mammoth from 'mammoth';\r?\n?/g, '');

// 2. Remove extractTextFromBuffer exactly
const extractRegex = /async function extractTextFromBuffer\([\s\S]*?^\}/m;
code = code.replace(extractRegex, '');

// 3. Remove chunkText exactly
const chunkRegex = /function chunkText\([\s\S]*?^\}/m;
code = code.replace(chunkRegex, '');

// 4. Replace parseFullExamFromFileWithGemini exactly
const parseRegex = /export const parseFullExamFromFileWithGemini = async \(file: Express\.Multer\.File\): Promise<FullExamData> => \{[\s\S]*?^\};\n/m;
const newFunc = `export const parseFullExamFromFileWithGemini = async (file: Express.Multer.File): Promise<FullExamData> => {
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
code = code.replace(parseRegex, newFunc);

fs.writeFileSync('src/services/geminiService.ts', code);
console.log("Patched safely");

