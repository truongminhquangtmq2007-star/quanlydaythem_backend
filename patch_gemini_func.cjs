const fs = require('fs');
let code = fs.readFileSync('src/services/geminiService.ts', 'utf8');

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
        fs.writeFileSync('src/services/geminiService.ts', code);
        console.log("Patched function specifically");
    } else {
        console.log("Could not find nextFuncStr");
    }
} else {
    console.log("Could not find parseFileStartStr");
}
