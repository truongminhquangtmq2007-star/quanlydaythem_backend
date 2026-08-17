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

export interface FullExamData {
  part1: MultipleChoiceQuestion[];
  part2: TrueFalseQuestion[];
  part3: ShortAnswerQuestion[];
}

// ==========================================
// ĐỊNH NGHĨA SCHEMA DÙNG CHUNG CHO CẢ TEXT VÀ FILE
// (Ép AI phải trả về đúng cấu trúc JSON này)
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
  },
  required: ['part1', 'part2', 'part3'],
};

// ==========================================
// 1. HÀM GỌI GEMINI XỬ LÝ VĂN BẢN (TEXT)
// ==========================================
export async function parseFullExamWithGemini(rawText: string): Promise<FullExamData> {
  const prompt = `
Bạn là một chuyên gia số hóa đề thi Toán học/Khoa học.
Nhiệm vụ: Phân tích toàn bộ nội dung đề thi được cung cấp và bóc tách thành đúng 3 phần theo chuẩn đề thi mới:

1. PHẦN I (part1): Câu trắc nghiệm nhiều phương án lựa chọn (A, B, C, D).
2. PHẦN II (part2): Câu trắc nghiệm Đúng/Sai. Mỗi câu có ngữ cảnh và 4 mệnh đề a, b, c, d. Đáp án mỗi mệnh đề là 'Đ' (Đúng) hoặc 'S' (Sai).
3. PHẦN III (part3): Câu trắc nghiệm trả lời ngắn (học sinh tự điền số/kết quả).

YÊU CẦU BẮT BUỘC:
- Mọi công thức Toán/Ký hiệu khoa học phải được chuyển thành định dạng LaTeX chuẩn (kẹp giữa dấu $, ví dụ: $f(x) = 9^x$).
- Trả về định dạng JSON thuần túy theo đúng Schema quy định.

Nội dung đề thi:
${rawText}
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash', // Sửa lại thành bản 1.5
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: examResponseSchema,
      },
    });

    if (!response.text) {
      throw new Error('Gemini không trả về dữ liệu');
    }

    const examData: FullExamData = JSON.parse(response.text);
    return examData;
  } catch (error) {
    console.error('Lỗi khi bóc tách đề thi với Gemini:', error);
    throw error;
  }
}

// ==========================================
// 2. HÀM GỌI GEMINI XỬ LÝ TỪ FILE (PDF/ẢNH)
// ==========================================
export const parseFullExamFromFileWithGemini = async (file: Express.Multer.File): Promise<FullExamData> => {
  try {
    const prompt = `Bạn là một chuyên gia số hóa đề thi Toán học/Khoa học. Hãy đọc file đề thi đính kèm và bóc tách dữ liệu thành đúng 3 phần (Trắc nghiệm nhiều lựa chọn, Đúng/Sai, Trả lời ngắn). Trả về JSON thuần túy theo Schema quy định. Nhớ giữ nguyên các công thức Toán học chuẩn LaTeX.`;

    // Gọi SDK mới, truyền cả văn bản và file dưới dạng Base64
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [
        prompt,
        {
          inlineData: {
            data: file.buffer.toString("base64"),
            mimeType: file.mimetype,
          }
        }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: examResponseSchema, // Dùng chung Schema với phần Text
      }
    });

    if (!response.text) {
        throw new Error('Gemini không trả về dữ liệu từ File');
    }

    const examData: FullExamData = JSON.parse(response.text);
    return examData;
  } catch (error) {
    console.error('Lỗi khi bóc tách file với Gemini:', error);
    throw error;
  }
};