import { GoogleGenAI, Type, Schema } from '@google/genai';
import * as dotenv from 'dotenv';

dotenv.config();

const MAX_RETRIES_PER_MODEL = 3;

const MODEL_FALLBACK_CHAIN = [
  'gemini-3.7-flash', 
  'gemini-3.6-flash',
  'gemini-3.5-flash'
];

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

  for (const modelName of MODEL_FALLBACK_CHAIN) {
    for (let attempt = 1; attempt <= MAX_RETRIES_PER_MODEL; attempt++) {
      try {
        console.log(`🔄 Đang thử gọi AI với model: ${modelName} (Lần ${attempt})...`);
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
        console.warn(`⚠️ Model [${modelName}] thất bại: ${error.message}`);
        
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






// ==========================================
// PROMPT CHUẨN DÙNG CHUNG CHO CẢ TEXT VÀ FILE
// ==========================================

const TAXONOMIES = {
  "Toán Học": ["Đại Số", "Hình Học", "Lượng Giác", "Giải Tích"],
  "Vật Lý": ["Cơ Học", "Nhiệt Học", "Điện Từ Học", "Quang Học", "Vật Lý Lượng Tử"],
  "Hóa Học": ["Vô Cơ", "Hữu Cơ", "Hóa Lý", "Hóa Phân Tích"],
  "Sinh Học": ["Tế Bào", "Di Truyền", "Tiến Hóa", "Sinh Thái"],
  "Tiếng Anh": ["Ngữ Pháp", "Từ Vựng", "Đọc Hiểu", "Viết"]
};

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


export function normalizeExamData(data: any): FullExamData {
  if (!data || typeof data !== 'object') {
    return { part1: [], part2: [], part3: [], shared_context: [], sharedContexts: [] };
  }

  const part1: MultipleChoiceQuestion[] = Array.isArray(data.part1) ? data.part1 : [];
  const part2: TrueFalseQuestion[] = Array.isArray(data.part2) ? data.part2 : [];
  const part3: ShortAnswerQuestion[] = Array.isArray(data.part3) ? data.part3 : [];

  part1.forEach((q: any) => {
    q.part = 'part1';
    q.part_number = 1;
    q.question_type = 'MCQ';
  });

  part2.forEach((q: any) => {
    q.part = 'part2';
    q.part_number = 2;
    q.question_type = 'TRUE_FALSE';
  });

  part3.forEach((q: any) => {
    q.part = 'part3';
    q.part_number = 3;
    q.question_type = 'SHORT_ANSWER';
  });

  const rawShared = data.shared_context || data.sharedContexts || [];
  const sharedList: SharedContext[] = Array.isArray(rawShared) ? rawShared : rawShared ? [rawShared] : [];

  sharedList.forEach((item: any, idx: number) => {
    if (!item.id && !item.context_id) {
      item.id = idx + 1;
    }
    const qIds: number[] = Array.isArray(item.questionIds) ? item.questionIds : (Array.isArray(item.question_ids) ? item.question_ids : []);
    item.questionIds = qIds;

    // Resolve part: do NOT default to part1 if questionIds actually belong to part2 or part3
    if (!item.part || (item.part !== 'part1' && item.part !== 'part2' && item.part !== 'part3')) {
      if (item.part_number === 2) item.part = 'part2';
      else if (item.part_number === 3) item.part = 'part3';
      else if (item.part_number === 1) item.part = 'part1';
      else {
        const subQs = Array.isArray(item.questions) ? item.questions : [];
        const isSubP2 = subQs.some((sq: any) => sq.question_type === 'TRUE_FALSE' || sq.statements || sq.part === 'part2' || sq.part_number === 2);
        const isSubP3 = subQs.some((sq: any) => sq.question_type === 'SHORT_ANSWER' || sq.part === 'part3' || sq.part_number === 3);
        const isSubP1 = subQs.some((sq: any) => sq.question_type === 'MCQ' || sq.options || sq.part === 'part1' || sq.part_number === 1);
        if (isSubP2 && !isSubP1 && !isSubP3) item.part = 'part2';
        else if (isSubP3 && !isSubP1 && !isSubP2) item.part = 'part3';
        else if (isSubP1 && !isSubP2 && !isSubP3) item.part = 'part1';
        else {
          const inP2 = part2.some(q => qIds.some(qid => String(qid) === String(q.id)));
          const inP3 = part3.some(q => qIds.some(qid => String(qid) === String(q.id)));
          const inP1 = part1.some(q => qIds.some(qid => String(qid) === String(q.id)));
          if (inP2 && !inP1 && !inP3) item.part = 'part2';
          else if (inP3 && !inP1 && !inP2) item.part = 'part3';
          else if (inP1 && !inP2 && !inP3) item.part = 'part1';
          else {
            const p2HasQ = part2.some(q => qIds.some(qid => String(qid) === String(q.id)) && !q.context_id);
            const p3HasQ = part3.some(q => qIds.some(qid => String(qid) === String(q.id)) && !q.context_id);
            const p1HasQ = part1.some(q => qIds.some(qid => String(qid) === String(q.id)) && !q.context_id);
            if (p2HasQ && !p1HasQ && !p3HasQ) item.part = 'part2';
            else if (p3HasQ && !p1HasQ && !p2HasQ) item.part = 'part3';
            else if (p1HasQ && !p2HasQ && !p3HasQ) item.part = 'part1';
            else item.part = 'part1';
          }
        }
      }
    }

    // Attach context_id ONLY to questions in the matching part
    const ctxId = item.id || item.context_id;
    if (ctxId) {
      const targetLists = item.part === 'part2' ? [part2] 
                        : item.part === 'part3' ? [part3] 
                        : item.part === 'part1' ? [part1] 
                        : [part1, part2, part3];
      targetLists.forEach(pList => {
        pList.forEach((q: any) => {
          if (qIds.some(qid => String(qid) === String(q.id))) {
            q.context_id = ctxId;
          }
        });
      });
    }
  });

  return {
    part1,
    part2,
    part3,
    shared_context: sharedList,
    sharedContexts: sharedList
  };
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


/**
 * AI Router: Hàm này có thể mở rộng để gọi OpenAI/Claude sau này
 * dựa trên biến môi trường (vd: process.env.AI_PROVIDER).
 * Hiện tại mặc định sử dụng Google Gemini (gemini-2.5-flash).
 */
export const explainErrorWithAI = async (prompt: string): Promise<string> => {
    try {
        const provider = process.env.AI_PROVIDER || 'gemini';
        
        if (provider === 'gemini') {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });
            return response.text || 'AI không trả về kết quả.';
        }
        
        // Cắm thêm OpenAI/Claude ở đây nếu provider khác
        throw new Error(`AI Provider ${provider} chưa được hỗ trợ.`);
    } catch (error) {
        console.error('Lỗi khi gọi AI Service:', error);
        throw error;
    }
};
