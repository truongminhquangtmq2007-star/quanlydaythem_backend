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
Bạn là một giáo viên Toán học xuất sắc và chuyên gia số hóa đề thi.
Nhiệm vụ: Phân tích nội dung đề thi và bóc tách thành đúng 3 phần theo chuẩn.

YÊU CẦU BẮT BUỘC:
1. LATEX: Mọi công thức Toán/Ký hiệu khoa học, bảng biểu (array, matrix) TUYỆT ĐỐI KHÔNG được để trần trụi mà BẮT BUỘC phải bọc trong cặp dấu $ $ (Ví dụ: $\\frac{1}{2}$). 
2. CÚ PHÁP LATEX TRONG JSON: Chỉ sử dụng MỘT dấu gạch chéo cho các lệnh LaTeX (ví dụ: \\frac, \\int). Tuyệt đối không dùng gạch chéo đôi (\\\\frac).
3. TỰ GIẢI TOÁN: Nếu đề thi KHÔNG CÓ CUNG CẤP ĐÁP ÁN, bạn BẮT BUỘC phải đóng vai giáo viên để TỰ GIẢI các bài toán đó và điền kết quả vào trường correctAnswer.
4. FORMAT ĐÁP ÁN: 
   - Phần 1: correctAnswer chỉ điền A, B, C, hoặc D.
   - Phần 2 (Đúng/Sai): correctAnswer của mỗi mệnh đề a, b, c, d BẮT BUỘC chỉ được điền chính xác một chữ cái "Đ" (nếu mệnh đề đó Đúng) hoặc "S" (nếu mệnh đề đó Sai). Tuyệt đối không điền chữ "Đúng", "Sai", "True", hay "False".
5. Trả về định dạng JSON thuần túy theo đúng Schema quy định.

Nội dung đề thi:
${rawText}
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash', // SỬ DỤNG BẢN CHUẨN ĐỂ KHÔNG BỊ LỖI 404
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
    const prompt = `
Bạn là một giáo viên Toán học xuất sắc và chuyên gia số hóa đề thi. Hãy đọc file đề thi đính kèm và bóc tách dữ liệu thành 3 phần. 

YÊU CẦU ĐẶC BIỆT:
1. Nếu đề bài không có sẵn đáp án cuối file, BẮT BUỘC bạn phải TỰ GIẢI toàn bộ các câu hỏi để tìm ra đáp án đúng.
2. Đối với Phần 2 (Câu trắc nghiệm Đúng/Sai), ở mục correctAnswer của từng mệnh đề a, b, c, d, bạn BẮT BUỘC CHỈ ĐƯỢC ĐIỀN chữ "Đ" hoặc chữ "S". Tuyệt đối cấm điền các từ ngữ khác.
3. TUYỆT ĐỐI KHÔNG để mã LaTeX trần trụi. MỌI công thức, phân số, hay bảng biểu (array, matrix) bắt buộc phải được bọc trong cặp dấu $ $ (Ví dụ: $\\frac{1}{2}$).
4. Chỉ sử dụng MỘT dấu gạch chéo cho các lệnh LaTeX trong JSON (ví dụ: \\frac, \\int). Không được dùng gạch chéo đôi.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash', // SỬ DỤNG BẢN CHUẨN ĐỂ KHÔNG BỊ LỖI 404
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
        responseSchema: examResponseSchema,
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