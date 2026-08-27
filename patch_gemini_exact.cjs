const fs = require('fs');
let code = fs.readFileSync('src/services/geminiService.ts', 'utf8');

// 1. Remove pdf-parse and mammoth imports
code = code.replace(/const pdfParse = require\('pdf-parse'\);\n?/g, '');
code = code.replace(/import mammoth from 'mammoth';\n?/g, '');

// 2. Remove extractTextFromBuffer
const extractStartStr = 'async function extractTextFromBuffer(buffer: Buffer, mimetype: string): Promise<string> {';
const extractStartIndex = code.indexOf(extractStartStr);
if (extractStartIndex !== -1) {
    const chunkStartStr = 'function chunkText(text: string): string[] {';
    const chunkStartIndex = code.indexOf(chunkStartStr);
    if (chunkStartIndex !== -1) {
        code = code.substring(0, extractStartIndex) + code.substring(chunkStartIndex);
    }
}

// 3. Remove chunkText
const chunkStartStr = 'function chunkText(text: string): string[] {';
const chunkStartIndex = code.indexOf(chunkStartStr);
if (chunkStartIndex !== -1) {
    const parseFileStartStr = 'export const parseFullExamFromFileWithGemini = async (file: Express.Multer.File): Promise<FullExamData> => {';
    const parseFileStartIndex = code.indexOf(parseFileStartStr);
    if (parseFileStartIndex !== -1) {
        code = code.substring(0, chunkStartIndex) + code.substring(parseFileStartIndex);
    }
}

// 4. Replace parseFullExamFromFileWithGemini
const parseFileStartStr = 'export const parseFullExamFromFileWithGemini = async (file: Express.Multer.File): Promise<FullExamData> => {';
const parseFileStartIndex = code.indexOf(parseFileStartStr);
if (parseFileStartIndex !== -1) {
    const nextFuncStr = 'export async function generateWithFallback(prompt: string): Promise<string> {';
    const nextFuncIndex = code.indexOf(nextFuncStr);
    
    if (nextFuncIndex !== -1) {
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
        code = code.substring(0, parseFileStartIndex) + newFunc + code.substring(nextFuncIndex);
    }
}

fs.writeFileSync('src/services/geminiService.ts', code);
console.log("Patched correctly");
