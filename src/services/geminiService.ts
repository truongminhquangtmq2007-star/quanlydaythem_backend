import { GoogleGenAI, Type } from '@google/genai';
import { TAXONOMIES } from '../constants/taxonomies';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: { timeout: 90000 }
});

export interface MultipleChoiceQuestion {
  id: number;
  questionText: string;
  image_url?: string;
  options: { A: string; B: string; C: string; D: string; };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  context_id?: number;
}

export interface TrueFalseQuestion {
  id: number;
  questionText: string;
  image_url?: string;
  statements: { a: string; b: string; c: string; d: string; };
  correctAnswer: {
    a: 'Đ' | 'S'; b: 'Đ' | 'S'; c: 'Đ' | 'S'; d: 'Đ' | 'S';
  };
  context_id?: number;
}

export interface ShortAnswerQuestion {
  id: number;
  questionText: string;
  image_url?: string;
  correctAnswer: string; 
  context_id?: number;
}

// MỚI: Khai báo interface cho Câu hỏi chùm (Ngữ cảnh chung / Shared Context)
export interface SharedContext {
  id: number;
  content: string;
  image_url?: string;
  questionIds: number[];
  part?: string;
  questions?: (MultipleChoiceQuestion | TrueFalseQuestion | ShortAnswerQuestion | any)[];
  context_id?: number;
}

export interface FullExamData {
  part1: MultipleChoiceQuestion[];
  part2: TrueFalseQuestion[];
  part3: ShortAnswerQuestion[];
  shared_context?: SharedContext[]; // Hỗ trợ trường shared_context
  sharedContexts?: SharedContext[]; // Tương thích ngược với frontend
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
          image_url: { type: Type.STRING },
          options: {
            type: Type.OBJECT,
            properties: { A: { type: Type.STRING }, B: { type: Type.STRING }, C: { type: Type.STRING }, D: { type: Type.STRING } },
            required: ['A', 'B', 'C', 'D'],
          },
          correctAnswer: { type: Type.STRING },
          main_topic: { type: Type.STRING },
          sub_topic: { type: Type.STRING },
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
          image_url: { type: Type.STRING },
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
          main_topic: { type: Type.STRING },
          sub_topic: { type: Type.STRING },
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
          image_url: { type: Type.STRING },
          correctAnswer: { type: Type.STRING },
          main_topic: { type: Type.STRING },
          sub_topic: { type: Type.STRING },
        },
        required: ['id', 'questionText', 'correctAnswer'],
      },
    },
    // Schema cho shared_context (Câu hỏi chùm / Ngữ cảnh chung)
    shared_context: {
      type: Type.ARRAY,
      description: "Danh sách câu hỏi chùm có ngữ cảnh/đoạn văn/đồ thị dùng chung",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.INTEGER },
          content: { type: Type.STRING, description: "Nội dung đoạn văn đọc hiểu, đồ thị hoặc bảng biểu dùng chung" },
          image_url: { type: Type.STRING },
          questionIds: { type: Type.ARRAY, items: { type: Type.INTEGER } },
          part: { type: Type.STRING, description: "Phần chứa các câu hỏi (ví dụ: part1, reading, cloze_test... hoặc để trống)" },
          questions: {
            type: Type.ARRAY,
            description: "Mảng các câu hỏi con thuộc ngữ cảnh chung này",
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.INTEGER },
                questionText: { type: Type.STRING },
                options: {
                  type: Type.OBJECT,
                  properties: { A: { type: Type.STRING }, B: { type: Type.STRING }, C: { type: Type.STRING }, D: { type: Type.STRING } },
                },
                statements: {
                  type: Type.OBJECT,
                  properties: { a: { type: Type.STRING }, b: { type: Type.STRING }, c: { type: Type.STRING }, d: { type: Type.STRING } },
                },
                correctAnswer: { type: Type.STRING },
              },
              required: ['id', 'questionText'],
            },
          },
        },
        required: ['id', 'content', 'questionIds'],
      },
    },
  },
  required: ['part1', 'part2', 'part3'],
};

// ==========================================
// CƠ CHẾ TỰ ĐỘNG THỬ LẠI (RETRY) KHI GEMINI QUÁ TẢI
// ==========================================
const MODEL_FALLBACK_CHAIN = [
  'gemini-3.7-flash',           // Mạnh nhất
  'gemini-3.6-flash',  // Nhanh, ổn định
  'gemini-3.5-flash',         // Dự phòng flash
  'gemini-3.1-pro-preview',         // Thế hệ trước, dự phòng
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
Bạn là một giáo viên xuất sắc và chuyên gia số hóa đề thi THPT theo cấu trúc chuẩn của Bộ Giáo dục & Đào tạo. 
Nhiệm vụ: Tự động nhận diện môn học, bóc tách đề thi chuẩn xác và xử lý câu hỏi chùm (Shared Context).

QUY TẮC NHẬN DIỆN MÔN HỌC & CẤU TRÚC ĐỀ (CỰC KỲ QUAN TRỌNG):
1. NHẬN DIỆN MÔN HỌC TRƯỚC KHI BÓC TÁCH:
   - NẾU LÀ ĐỀ THI TIẾNG ANH:
     + Hãy BỎ QUA quy tắc chia 3 phần. Toàn bộ đề Tiếng Anh là trắc nghiệm 4 lựa chọn (A, B, C, D) -> ĐƯA TOÀN BỘ CÂU HỎI VÀO 'part1'. Còn 'part2' và 'part3' để là mảng rỗng [].
     + NHIỆM VỤ CHÍNH ĐỐI VỚI TIẾNG ANH: Tìm các bài Đọc hiểu (Reading Comprehension) hoặc Điền từ (Cloze test), gom toàn bộ phần bài đọc / đoạn văn bản chung đó vào 'shared_context' (trường 'content'), và đặt các câu hỏi liên quan vào mảng 'questions' bên trong (đồng thời các câu hỏi này vẫn được đánh số thứ tự câu trong mảng 'part1').
   - NẾU LÀ CÁC MÔN KHOA HỌC / TOÁN / KHTN / KHXH (Cấu trúc 3 phần chuẩn THPT):
     + Phần 1 (part1): Câu trắc nghiệm nhiều lựa chọn (4 lựa chọn A, B, C, D).
     + Phần 2 (part2): Câu trắc nghiệm Đúng/Sai (mỗi câu gồm 4 ý a, b, c, d).
     + Phần 3 (part3): Câu trắc nghiệm Trả lời ngắn (điền kết quả/số).
     + Câu hỏi chùm (shared_context): Gom đoạn văn/bảng số liệu/đồ thị chung vào 'shared_context', và đặt các câu hỏi con vào mảng 'questions' bên trong.

YÊU CẦU BẮT BUỘC:
1. TỰ GIẢI ĐỀ: Nếu đề bài không có sẵn đáp án cuối file, BẮT BUỘC bạn phải TỰ GIẢI toàn bộ các câu hỏi để tìm ra đáp án chính xác điền vào 'correctAnswer'.
2. LATEX: Đối với các môn Toán/Khoa học, mọi công thức Toán/Ký hiệu khoa học TUYỆT ĐỐI KHÔNG được để trần trụi mà BẮT BUỘC phải bọc trong cặp dấu $ $ (Ví dụ: $\\frac{1}{2}$). 
3. CÚ PHÁP LATEX:
   - Viết các lệnh LaTeX theo cú pháp chuẩn, ví dụ: \\frac{1}{2}, \\sqrt{x}, \\overline{AB}, \\vec{u}, \\int.
   - Không tự ý thay đổi hoặc loại bỏ dấu \\ của các lệnh LaTeX.
   - Hệ thống sẽ tự xử lý việc mã hóa chuỗi JSON, vì vậy chỉ cần tạo biểu thức LaTeX đúng cú pháp.
4. FORMAT ĐÁP ÁN: 
   - Phần 1: correctAnswer chỉ điền A, B, C, hoặc D.
   - Phần 2 (Đúng/Sai): correctAnswer của mỗi mệnh đề a, b, c, d BẮT BUỘC chỉ được điền chính xác một chữ cái "Đ" (Đúng) hoặc "S" (Sai).
   - Phần 3 (Trả lời ngắn): correctAnswer điền kết quả dạng chuỗi ngắn gọn (ví dụ: "3.5", "-2", "1/2").
5. NHẬN DIỆN CÂU HỎI CHÙM (SHARED CONTEXT): 
   Nếu đề thi có các câu hỏi dùng chung một đoạn văn bản đọc hiểu, bài đọc điền từ, bảng biểu, đồ thị hoặc ngữ cảnh dữ liệu:
   - Tách riêng đoạn ngữ cảnh chung đó vào mảng "shared_context".
   - Mỗi phần tử trong "shared_context" gồm:
     + "id": số thứ tự nhóm (1, 2, ...)
     + "content": toàn bộ nội dung bài đọc / đoạn văn đọc hiểu / đoạn điền từ / bảng biểu hoặc dữ liệu dùng chung.
     + "questionIds": danh sách id các câu hỏi áp dụng (ví dụ: [1, 2, 3, 4, 5]).
     + "part": phần chứa các câu hỏi đó (ví dụ: 'part1', hoặc để trống đối với Tiếng Anh).
     + "questions": mảng danh sách các câu hỏi con chi tiết tương ứng bên trong ngữ cảnh này.
   - Các câu hỏi con này vẫn PHẢI xuất hiện đầy đủ trong mảng part1 (hoặc part tương ứng) để đảm bảo toàn bộ đề thi có đầy đủ danh sách câu hỏi.
   - KHÔNG lặp lại bài đọc / ngữ cảnh dùng chung này vào "questionText" của từng câu con.
6. CẤM TUYỆT ĐỐI DÙNG BẢNG LATEX: KHÔNG được dùng \\begin{array}, \\begin{tabular}, \\begin{matrix} hay bất kỳ môi trường bảng LaTeX nào. Nếu đề bài có bảng số liệu (ví dụ bảng tần số ghép nhóm), hãy trình bày lại nội dung bảng đó dưới dạng VĂN BẢN THƯỜNG, liệt kê từng khoảng và giá trị tương ứng theo định dạng: "Nhóm [8,10): tần số 4; Nhóm [10,12): tần số 5; ..." Chỉ dùng ký hiệu $ $ cho CÔNG THỨC TOÁN ĐƠN LẺ.
7. PHÂN LOẠI DẠNG BÀI (BẮT BUỘC): Bạn là chuyên gia phân loại đề thi. Đối với mỗi câu hỏi, dựa vào dữ liệu danh mục cung cấp sau đây:
   ${JSON.stringify(TAXONOMIES)}
   Hãy chọn và trả về CHÍNH XÁC tên "main_topic" và "sub_topic" tương ứng. Không được tự bịa tên nằm ngoài danh sách. ( còn các môn được định nghĩa sẵn thì bắt buộc không được thay đổi hay bịa thêm,Nếu là Tiếng Anh hoặc các môn khác tự định nghĩa các chủ đề phù hợp như "Ngữ pháp", "Đọc hiểu", v.v.)
`;


function normalizeExamData(data: any): FullExamData {
  const shared = data.shared_context || data.sharedContexts || [];
  data.shared_context = shared;
  data.sharedContexts = shared;
  return data;
}

// ==========================================
// 1. HÀM GỌI GEMINI XỬ LÝ VĂN BẢN (TEXT)
// ==========================================
export async function parseFullExamWithGemini(rawText: string): Promise<FullExamData> {
  const contents = `${basePrompt}\n\nNội dung đề thi:\n${rawText}`;

  try {
    const text = await callGeminiWithRetry(contents);
    const examData: FullExamData = JSON.parse(text);
    return normalizeExamData(examData);
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
    return normalizeExamData(examData);
  } catch (error) {
    console.error('Lỗi khi bóc tách file với Gemini:', error);
    throw error;
  }
};


export async function generateWithFallback(prompt: string): Promise<string> {
  let lastError: any = null;

  for (const modelName of MODEL_FALLBACK_CHAIN) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
      });

      if (response.text) {
         return response.text;
      }
    } catch (error: any) {
      lastError = error;
      console.warn(`[AI Warning] Mô hình ${modelName} lỗi, đang thử mô hình tiếp theo...`, error.message);
    }
  }
  
  throw lastError;
}
