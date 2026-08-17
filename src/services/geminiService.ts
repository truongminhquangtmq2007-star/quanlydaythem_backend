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
// HÀM GỌI GEMINI XỬ LÝ VĂN BẢN
// ==========================================
export async function parseFullExamWithGemini(rawText: string): Promise<FullExamData> {
  const prompt = `
Bạn là một chuyên gia số hóa đề thi Toán học/Khoa học.
Nhiệm vụ: Phân tích toàn bộ nội dung đề thi được cung cấp và bóc tách thành đúng 3 phần theo chuẩn đề thi mới:

1. PHẦN I (part1): Câu trắc nghiệm nhiều phương án lựa chọn (A, B, C, D).
2. PHẦN II (part2): Câu trắc nghiệm Đúng/Sai. Mỗi câu có ngữ cảnh và 4 mệnh đề a, b, c, d. Đáp án mỗi mệnh đề là 'Đ' (Đúng) hoặc 'S' (Sai).
3. PHẦN III (part3): Câu trắc nghiệm trả lời ngắn (học sinh tự điền số/kết quả).

YÊU CẦU BẮT BUỘC:
- Mọi công thức Toán/Ký hiệu khoa học phải được chuyển thành định dạng LaTeX chuẩn (kẹp giữa dấu $, ví dụ: $f(x) = 9^x$, $\\int_0^2 e^x dx$).
- Trả về định dạng JSON thuần túy theo đúng Schema quy định.

Nội dung đề thi:
${rawText}
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash', // Dùng bản Flash cho nhanh và miễn phí
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
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
        },
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
export const parseFullExamFromFileWithGemini = async (file: Express.Multer.File) => {
  // Lấy API model (tương tự như hàm parseFullExamWithGemini)
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); 

  // Chuyển đổi Buffer của file sang dạng Base64 để Gemini đọc được
  const fileData = {
    inlineData: {
      data: file.buffer.toString("base64"),
      mimeType: file.mimetype,
    },
  };

  const prompt = `Bạn là một chuyên gia giáo dục. Hãy đọc file đề thi đính kèm và bóc tách dữ liệu theo đúng định dạng JSON 3 phần (Trắc nghiệm nhiều lựa chọn, Đúng/Sai, Trả lời ngắn). Trả về duy nhất một chuỗi JSON hợp lệ, không kèm văn bản giải thích. Cấu trúc JSON bắt buộc: { "part1": [...], "part2": [...], "part3": [...] }`;

  // Gửi cả Prompt và File cho AI
  const result = await model.generateContent([prompt, fileData]);
  const response = await result.response;
  let text = response.text();

  // Xóa các ký tự markdown JSON dư thừa (nếu có)
  text = text.replace(/```json/g, '').replace(/```/g, '').trim();

  return JSON.parse(text);
};