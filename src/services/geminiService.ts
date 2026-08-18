import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

// Khởi tạo Gemini AI với API Key trong file .env
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

// ==========================================
// ĐỊNH NGHĨA CẤU TRÚC ĐỀ THI
// ==========================================
export interface MultipleChoiceQuestion {
  id: number;
  questionText: string;
  image_url?: string;
  options: { A: string; B: string; C: string; D: string; };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
}

export interface TrueFalseQuestion {
  id: number;
  questionText: string;
  image_url?: string;
  statements: { a: string; b: string; c: string; d: string; };
  correctAnswer: {
    a: 'Đ' | 'S'; b: 'Đ' | 'S'; c: 'Đ' | 'S'; d: 'Đ' | 'S';
  };
}

export interface ShortAnswerQuestion {
  id: number;
  questionText: string;
  image_url?: string;
  correctAnswer: string; 
}

// MỚI: Khai báo interface cho Câu hỏi chùm (Ngữ cảnh chung)
export interface SharedContext {
  id: number;
  content: string;
  image_url?: string;
  questionIds: number[];
  part: 'part1' | 'part2' | 'part3';
}

export interface FullExamData {
  part1: MultipleChoiceQuestion[];
  part2: TrueFalseQuestion[];
  part3: ShortAnswerQuestion[];
  sharedContexts?: SharedContext[]; // MỚI: Thêm vào dữ liệu tổng
}

// ==========================================
// ĐỊNH NGHĨA SCHEMA (ÉP AI TRẢ VỀ ĐÚNG FORMAT)
// ==========================================
const examResponseSchema = {
  type: Type.OBJECT,
  properties: {
    part1: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.INTEGER },
          questionText: { type: Type.STRING },
          options: {
            type: Type.OBJECT,
            properties: { A: { type: Type.STRING }, B: { type: Type.STRING }, C: { type: Type.STRING }, D: { type: Type.STRING } },
            required: ['A', 'B', 'C', 'D'],
          },
          correctAnswer: { type: Type.STRING },
        },
        required: ['id', 'questionText', 'options', 'correctAnswer'],
      },
    },
    part2: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.INTEGER },
          questionText: { type: Type.STRING },
          statements: {
            type: Type.OBJECT,
            properties: { a: { type: Type.STRING }, b: { type: Type.STRING }, c: { type: Type.STRING }, d: { type: Type.STRING } },
            required: ['a', 'b', 'c', 'd'],
          },
          correctAnswer: {
            type: Type.OBJECT,
            properties: { a: { type: Type.STRING }, b: { type: Type.STRING }, c: { type: Type.STRING }, d: { type: Type.STRING } },
            required: ['a', 'b', 'c', 'd'],
          },
        },
        required: ['id', 'questionText', 'statements', 'correctAnswer'],
      },
    },
    part3: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.INTEGER },
          questionText: { type: Type.STRING },
          correctAnswer: { type: Type.STRING },
        },
        required: ['id', 'questionText', 'correctAnswer'],
      },
    },
    // MỚI: Schema cho sharedContexts
    sharedContexts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.INTEGER },
          content: { type: Type.STRING },
          image_url: { type: Type.STRING },
          questionIds: { type: Type.ARRAY, items: { type: Type.INTEGER } },
          part: { type: Type.STRING },
        },
        required: ['id', 'content', 'questionIds', 'part'],
      },
    },
  },
  required: ['part1', 'part2', 'part3'], // Không bắt buộc sharedContexts vì không phải đề nào cũng có
};

// ==========================================
// CƠ CHẾ TỰ ĐỘNG THỬ LẠI (RETRY) KHI GEMINI QUÁ TẢI
// ==========================================

// ĐÃ SỬA: Danh sách các model THẬT SỰ TỒN TẠI của Google
const MODEL_FALLBACK_CHAIN = [
'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-flash-latest',   // Phương án cuối: Nặng nhất, thông minh nhất
];

const MAX_RETRIES_PER_MODEL = 3;
const BASE_DELAY_MS = 2000;

function isRetryableError(error: any): boolean {
  const status = error?.status || error?.code;
  const message = String(error?.message || '');
  return (
    status === 429 ||
    status === 503 ||
    status === 500 ||
    message.includes('RESOURCE_EXHAUSTED') ||
    message.includes('UNAVAILABLE') ||
    message.includes('overloaded')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGeminiWithRetry(contents: any): Promise<string> {
  let lastError: any = null;

  for (const model of MODEL_FALLBACK_CHAIN) {
    for (let attempt = 1; attempt <= MAX_RETRIES_PER_MODEL; attempt++) {
      try {
        console.log(`🔄 Đang gọi Gemini [model: ${model}, lần thử: ${attempt}/${MAX_RETRIES_PER_MODEL}]...`);

        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            responseMimeType: 'application/json',
            responseSchema: examResponseSchema,
          },
        });

        if (!response.text) {
          throw new Error('Gemini không trả về dữ liệu (response rỗng)');
        }

        console.log(`✅ Gọi Gemini thành công với model: ${model}`);
        return response.text;
      } catch (error: any) {
        lastError = error;

        if (!isRetryableError(error)) {
          console.error(`❌ Lỗi không thể thử lại [model: ${model}]:`, error.message);
          throw error;
        }

        const delay = BASE_DELAY_MS * attempt;
        console.warn(`⚠️ Model [${model}] bị quá tải/hết quota. Chờ ${delay / 1000}s rồi thử lại...`);
        await sleep(delay);
      }
    }
    console.warn(`⛔ Model [${model}] đã thử hết ${MAX_RETRIES_PER_MODEL} lần vẫn lỗi. Chuyển sang model dự phòng...`);
  }

  console.error('❌ Đã thử hết toàn bộ model dự phòng nhưng vẫn thất bại.');
  throw lastError;
}

// ==========================================
// PROMPT CHUẨN DÙNG CHUNG CHO CẢ TEXT VÀ FILE
// ==========================================
const basePrompt = `
Bạn là một giáo viên Toán học xuất sắc và chuyên gia số hóa đề thi. 
Nhiệm vụ: Bóc tách dữ liệu đề thi thành 3 phần.

YÊU CẦU BẮT BUỘC:
1. TỰ GIẢI TOÁN: Nếu đề bài không có sẵn đáp án cuối file, BẮT BUỘC bạn phải TỰ GIẢI toàn bộ các câu hỏi để tìm ra đáp án đúng điền vào 'correctAnswer'.
2. LATEX: Mọi công thức Toán/Ký hiệu khoa học, bảng biểu (array, matrix) TUYỆT ĐỐI KHÔNG được để trần trụi mà BẮT BUỘC phải bọc trong cặp dấu $ $ (Ví dụ: $\\frac{1}{2}$). 
3. CÚ PHÁP LATEX TRONG JSON: Chỉ sử dụng MỘT dấu gạch chéo cho các lệnh LaTeX (ví dụ: \\frac, \\int). Tuyệt đối không dùng gạch chéo đôi (\\\\frac).
4. FORMAT ĐÁP ÁN: 
   - Phần 1: correctAnswer chỉ điền A, B, C, hoặc D.
   - Phần 2 (Đúng/Sai): correctAnswer của mỗi mệnh đề a, b, c, d BẮT BUỘC chỉ được điền chính xác một chữ cái "Đ" (Đúng) hoặc "S" (Sai).
5. NHẬN DIỆN CÂU HỎI NHÓM (CỰC KỲ QUAN TRỌNG): Nếu đề thi có các câu hỏi dùng chung một đoạn ngữ cảnh, bảng biểu hoặc dữ liệu (ví dụ: "Dựa vào thông tin sau, trả lời câu 4, 5, 6"), hãy tách riêng đoạn ngữ cảnh đó ra thành một phần tử trong mảng "sharedContexts". 
   - "questionIds" là danh sách các câu áp dụng (ví dụ: [4, 5, 6]).
   - "part" là phần chứa các câu đó ('part1', 'part2', hoặc 'part3').
   - KHÔNG lặp lại đoạn ngữ cảnh này vào "questionText" của từng câu con bên dưới nữa.
`;

// ==========================================
// 1. HÀM GỌI GEMINI XỬ LÝ VĂN BẢN (TEXT)
// ==========================================
export async function parseFullExamWithGemini(rawText: string): Promise<FullExamData> {
  try {
    const text = await callGeminiWithRetry(`${basePrompt}\n\nNội dung đề thi:\n${rawText}`);
    const examData: FullExamData = JSON.parse(text);
    return examData;
  } catch (error) {
    console.error('Lỗi khi bóc tách đề thi với Gemini (text):', error);
    throw error;
  }
}

// ==========================================
// 2. HÀM GỌI GEMINI XỬ LÝ TỪ FILE (PDF/ẢNH)
// ==========================================
export const parseFullExamFromFileWithGemini = async (file: Express.Multer.File): Promise<FullExamData> => {
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
    return examData;
  } catch (error) {
    console.error('Lỗi khi bóc tách file với Gemini:', error);
    throw error;
  }
};