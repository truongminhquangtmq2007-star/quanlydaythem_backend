const fs = require('fs');
let code = fs.readFileSync('src/services/geminiService.ts', 'utf8');

const newImports = `
import { GoogleGenAI, Type, Schema } from '@google/genai';
import * as dotenv from 'dotenv';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

dotenv.config();

const MAX_RETRIES_PER_MODEL = 3;

const MODEL_FALLBACK_CHAIN = [
  'gemini-3.7-flash', 
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.1-pro-preview',
  'gemini-2.5-flash',
  'gemini-1.5-flash'
];

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: { timeout: 90000 }
});
`;

// Replace imports and init
const oldImportsRegex = /import\s+\{\s*GoogleGenAI[\s\S]*?apiKey:\s*process\.env\.GEMINI_API_KEY\s*\|\|\s*'',\s*(?:httpOptions:\s*\{\s*timeout:\s*90000\s*\}\s*)?\}\);/m;
code = code.replace(oldImportsRegex, newImports.trim());
// Add MODEL_FALLBACK_CHAIN if it doesn't exist
if (!code.includes('MODEL_FALLBACK_CHAIN')) {
    code = code.replace("const MAX_RETRIES_PER_MODEL = 3;", "const MAX_RETRIES_PER_MODEL = 3;\nconst MODEL_FALLBACK_CHAIN = ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.1-pro-preview', 'gemini-2.5-flash', 'gemini-1.5-flash'];");
}

const callGeminiFn = `
async function callGeminiWithRetry(contents: any): Promise<string> {
  let lastError: any = null;

  for (const modelName of MODEL_FALLBACK_CHAIN) {
    for (let attempt = 1; attempt <= MAX_RETRIES_PER_MODEL; attempt++) {
      try {
        console.log(\`🔄 Đang thử gọi AI với model: \${modelName} (Lần \${attempt})...\`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            responseMimeType: 'application/json',
            responseSchema: examResponseSchema,
          },
        });

        if (response.text) {
          return response.text;
        } else {
            throw new Error('Gemini không trả về dữ liệu (response rỗng)');
        }
      } catch (error: any) {
        lastError = error;
        console.warn(\`⚠️ Model [\${modelName}] thất bại: \${error.message}\`);
        
        if (error.status === 504 || error.status === 429 || error.message.includes('504') || error.message.includes('TIMEOUT') || error.message.includes('fetch failed')) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        } else {
            break; // If not a timeout/ratelimit, move to next model immediately or throw? Wait, the prompt says "Nếu lỗi 504 hoặc 429, delay... Tiếp tục vòng lặp sang model dự phòng" 
            // So we just break the attempt loop to move to the next model!
            break;
        }
      }
    }
  }
  
  throw new Error("Tất cả các model AI đều thất bại hoặc quá tải. Lỗi cuối cùng: " + lastError.message);
}

async function extractTextFromBuffer(buffer: Buffer, mimetype: string): Promise<string> {
    if (mimetype === 'application/pdf') {
        const data = await pdfParse(buffer);
        return data.text;
    } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || mimetype === 'application/msword') {
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
    } else if (mimetype.startsWith('image/')) {
        // Use Gemini to extract text from image
        let lastError = null;
        for (const modelName of MODEL_FALLBACK_CHAIN) {
            try {
                const response = await ai.models.generateContent({
                    model: modelName,
                    contents: [
                        "Hãy trích xuất toàn bộ văn bản trong bức ảnh này một cách chính xác nhất.",
                        { inlineData: { data: buffer.toString('base64'), mimeType: mimetype } }
                    ]
                });
                if (response.text) return response.text;
            } catch(e: any) {
                lastError = e;
            }
        }
        return "Không thể trích xuất văn bản từ ảnh.";
    }
    return buffer.toString('utf8');
}

function chunkText(text: string): string[] {
    const regex = /(Câu\s+\d+[:\.])/gi;
    let match;
    const indices = [];
    while ((match = regex.exec(text)) !== null) {
        indices.push(match.index);
    }

    if (indices.length <= 10) return [text];

    const chunks: string[] = [];
    let currentChunkStartIndex = 0;
    
    for (let i = 0; i < indices.length; i += 10) {
        const chunkEndIndex = i + 10 < indices.length ? indices[i + 10] : text.length;
        chunks.push(text.slice(currentChunkStartIndex, chunkEndIndex));
        currentChunkStartIndex = chunkEndIndex;
    }
    
    return chunks;
}
`;

code = code.replace(/async function callGeminiWithRetry\([\s\S]*?throw lastError;\n\}/m, callGeminiFn);

// Fallback logic
if (!code.includes('extractTextFromBuffer')) {
    code = code.replace(/async function callGeminiWithRetry[\s\S]*?^\}/m, callGeminiFn);
}

const parseFromFileFn = `
export const parseFullExamFromFileWithGemini = async (file: Express.Multer.File): Promise<FullExamData> => {
  try {
    const rawText = await extractTextFromBuffer(file.buffer, file.mimetype);
    const chunks = chunkText(rawText);
    
    const allQuestions: any = { part1: [], part2: [], part3: [], shared_context: [] };
    
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const contents = \`\${basePrompt}\\n\\nNội dung đề thi (Phần \${i+1}/\${chunks.length}):\\n\${chunk}\`;
        
        const text = await callGeminiWithRetry(contents);
        const examData: FullExamData = JSON.parse(text);
        
        if (examData.part1) allQuestions.part1.push(...examData.part1);
        if (examData.part2) allQuestions.part2.push(...examData.part2);
        if (examData.part3) allQuestions.part3.push(...examData.part3);
        if (examData.shared_context) allQuestions.shared_context.push(...examData.shared_context);
        if (examData.sharedContexts) allQuestions.shared_context.push(...examData.sharedContexts);
    }

    return normalizeExamData(allQuestions);
  } catch (error) {
    console.error('Lỗi khi bóc tách file với Gemini:', error);
    throw error;
  }
};
`;

code = code.replace(/export const parseFullExamFromFileWithGemini = async \([\s\S]*?^\};/m, parseFromFileFn);

fs.writeFileSync('src/services/geminiService.ts', code);
console.log("Patched geminiService.ts");
