"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.explainErrorWithAI = exports.parseFullExamFromFileWithGemini = void 0;
exports.normalizeExamData = normalizeExamData;
exports.parseFullExamWithGemini = parseFullExamWithGemini;
exports.generateWithFallback = generateWithFallback;
exports.generateExamWithGemini = generateExamWithGemini;
exports.regenerateQuestionWithGemini = regenerateQuestionWithGemini;
const genai_1 = require("@google/genai");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const MAX_RETRIES_PER_MODEL = 3;
const MODEL_FALLBACK_CHAIN = [
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash'
];
const ai = new genai_1.GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || '',
    httpOptions: { timeout: 90000 }
});
// ==========================================
// ĐỊNH NGHĨA SCHEMA (ÉP AI TRẢ VỀ ĐÚNG FORMAT)
// ==========================================
const examResponseSchema = {
    type: genai_1.Type.OBJECT,
    properties: {
        part1: {
            type: genai_1.Type.ARRAY,
            items: {
                type: genai_1.Type.OBJECT,
                properties: {
                    id: { type: genai_1.Type.INTEGER },
                    questionText: { type: genai_1.Type.STRING },
                    image_url: { type: genai_1.Type.STRING },
                    options: {
                        type: genai_1.Type.OBJECT,
                        properties: { A: { type: genai_1.Type.STRING }, B: { type: genai_1.Type.STRING }, C: { type: genai_1.Type.STRING }, D: { type: genai_1.Type.STRING } },
                        required: ['A', 'B', 'C', 'D'],
                    },
                    correctAnswer: { type: genai_1.Type.STRING },
                    explanation: { type: genai_1.Type.STRING },
                    topic: { type: genai_1.Type.STRING },
                    difficulty: { type: genai_1.Type.STRING },
                    main_topic: { type: genai_1.Type.STRING },
                    sub_topic: { type: genai_1.Type.STRING },
                },
                required: ['id', 'questionText', 'options', 'correctAnswer'],
            },
        },
        part2: {
            type: genai_1.Type.ARRAY,
            items: {
                type: genai_1.Type.OBJECT,
                properties: {
                    id: { type: genai_1.Type.INTEGER },
                    questionText: { type: genai_1.Type.STRING },
                    image_url: { type: genai_1.Type.STRING },
                    statements: {
                        type: genai_1.Type.OBJECT,
                        properties: { a: { type: genai_1.Type.STRING }, b: { type: genai_1.Type.STRING }, c: { type: genai_1.Type.STRING }, d: { type: genai_1.Type.STRING } },
                        required: ['a', 'b', 'c', 'd'],
                    },
                    correctAnswer: {
                        type: genai_1.Type.OBJECT,
                        properties: { a: { type: genai_1.Type.STRING }, b: { type: genai_1.Type.STRING }, c: { type: genai_1.Type.STRING }, d: { type: genai_1.Type.STRING } },
                        required: ['a', 'b', 'c', 'd'],
                    },
                    explanation: { type: genai_1.Type.STRING },
                    topic: { type: genai_1.Type.STRING },
                    difficulty: { type: genai_1.Type.STRING },
                    main_topic: { type: genai_1.Type.STRING },
                    sub_topic: { type: genai_1.Type.STRING },
                },
                required: ['id', 'questionText', 'statements', 'correctAnswer'],
            },
        },
        part3: {
            type: genai_1.Type.ARRAY,
            items: {
                type: genai_1.Type.OBJECT,
                properties: {
                    id: { type: genai_1.Type.INTEGER },
                    questionText: { type: genai_1.Type.STRING },
                    image_url: { type: genai_1.Type.STRING },
                    correctAnswer: { type: genai_1.Type.STRING },
                    explanation: { type: genai_1.Type.STRING },
                    solution: { type: genai_1.Type.STRING },
                    topic: { type: genai_1.Type.STRING },
                    difficulty: { type: genai_1.Type.STRING },
                    main_topic: { type: genai_1.Type.STRING },
                    sub_topic: { type: genai_1.Type.STRING },
                },
                required: ['id', 'questionText', 'correctAnswer'],
            },
        },
        // Schema cho shared_context (Câu hỏi chùm / Ngữ cảnh chung)
        shared_context: {
            type: genai_1.Type.ARRAY,
            description: "Danh sách câu hỏi chùm có ngữ cảnh/đoạn văn/đồ thị dùng chung",
            items: {
                type: genai_1.Type.OBJECT,
                properties: {
                    id: { type: genai_1.Type.INTEGER },
                    content: { type: genai_1.Type.STRING, description: "Nội dung đoạn văn đọc hiểu, đồ thị hoặc bảng biểu dùng chung" },
                    image_url: { type: genai_1.Type.STRING },
                    questionIds: { type: genai_1.Type.ARRAY, items: { type: genai_1.Type.INTEGER } },
                    part: { type: genai_1.Type.STRING, description: "Phần chứa các câu hỏi (ví dụ: part1, reading, cloze_test... hoặc để trống)" },
                    questions: {
                        type: genai_1.Type.ARRAY,
                        description: "Mảng các câu hỏi con thuộc ngữ cảnh chung này",
                        items: {
                            type: genai_1.Type.OBJECT,
                            properties: {
                                id: { type: genai_1.Type.INTEGER },
                                questionText: { type: genai_1.Type.STRING },
                                options: {
                                    type: genai_1.Type.OBJECT,
                                    properties: { A: { type: genai_1.Type.STRING }, B: { type: genai_1.Type.STRING }, C: { type: genai_1.Type.STRING }, D: { type: genai_1.Type.STRING } },
                                },
                                statements: {
                                    type: genai_1.Type.OBJECT,
                                    properties: { a: { type: genai_1.Type.STRING }, b: { type: genai_1.Type.STRING }, c: { type: genai_1.Type.STRING }, d: { type: genai_1.Type.STRING } },
                                },
                                correctAnswer: { type: genai_1.Type.STRING },
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
function isRetryableError(error) {
    const status = error?.status || error?.code;
    const message = String(error?.message || '');
    return (status === 429 ||
        status === 503 ||
        status === 500 ||
        message.includes('RESOURCE_EXHAUSTED') ||
        message.includes('UNAVAILABLE') ||
        message.includes('overloaded'));
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function callGeminiWithRetry(contents) {
    let lastError = null;
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
                }
                else {
                    throw new Error('Gemini không trả về dữ liệu (response rỗng)');
                }
            }
            catch (error) {
                lastError = error;
                console.warn(`⚠️ Model [${modelName}] thất bại: ${error.message}`);
                if (error.status === 504 || error.status === 429 || error.message.includes('504') || error.message.includes('TIMEOUT') || error.message.includes('fetch failed')) {
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
                else {
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
function normalizeExamData(data) {
    if (!data || typeof data !== 'object') {
        return { part1: [], part2: [], part3: [], shared_context: [], sharedContexts: [] };
    }
    const part1 = Array.isArray(data.part1) ? data.part1 : [];
    const part2 = Array.isArray(data.part2) ? data.part2 : [];
    const part3 = Array.isArray(data.part3) ? data.part3 : [];
    part1.forEach((q) => {
        q.part = 'part1';
        q.part_number = 1;
        q.question_type = 'MCQ';
    });
    part2.forEach((q) => {
        q.part = 'part2';
        q.part_number = 2;
        q.question_type = 'TRUE_FALSE';
    });
    part3.forEach((q) => {
        q.part = 'part3';
        q.part_number = 3;
        q.question_type = 'SHORT_ANSWER';
    });
    const rawShared = data.shared_context || data.sharedContexts || [];
    const sharedList = Array.isArray(rawShared) ? rawShared : rawShared ? [rawShared] : [];
    sharedList.forEach((item, idx) => {
        if (!item.id && !item.context_id) {
            item.id = idx + 1;
        }
        const qIds = Array.isArray(item.questionIds) ? item.questionIds : (Array.isArray(item.question_ids) ? item.question_ids : []);
        item.questionIds = qIds;
        // Resolve part: do NOT default to part1 if questionIds actually belong to part2 or part3
        if (!item.part || (item.part !== 'part1' && item.part !== 'part2' && item.part !== 'part3')) {
            if (item.part_number === 2)
                item.part = 'part2';
            else if (item.part_number === 3)
                item.part = 'part3';
            else if (item.part_number === 1)
                item.part = 'part1';
            else {
                const subQs = Array.isArray(item.questions) ? item.questions : [];
                const isSubP2 = subQs.some((sq) => sq.question_type === 'TRUE_FALSE' || sq.statements || sq.part === 'part2' || sq.part_number === 2);
                const isSubP3 = subQs.some((sq) => sq.question_type === 'SHORT_ANSWER' || sq.part === 'part3' || sq.part_number === 3);
                const isSubP1 = subQs.some((sq) => sq.question_type === 'MCQ' || sq.options || sq.part === 'part1' || sq.part_number === 1);
                if (isSubP2 && !isSubP1 && !isSubP3)
                    item.part = 'part2';
                else if (isSubP3 && !isSubP1 && !isSubP2)
                    item.part = 'part3';
                else if (isSubP1 && !isSubP2 && !isSubP3)
                    item.part = 'part1';
                else {
                    const inP2 = part2.some(q => qIds.some(qid => String(qid) === String(q.id)));
                    const inP3 = part3.some(q => qIds.some(qid => String(qid) === String(q.id)));
                    const inP1 = part1.some(q => qIds.some(qid => String(qid) === String(q.id)));
                    if (inP2 && !inP1 && !inP3)
                        item.part = 'part2';
                    else if (inP3 && !inP1 && !inP2)
                        item.part = 'part3';
                    else if (inP1 && !inP2 && !inP3)
                        item.part = 'part1';
                    else {
                        const p2HasQ = part2.some(q => qIds.some(qid => String(qid) === String(q.id)) && !q.context_id);
                        const p3HasQ = part3.some(q => qIds.some(qid => String(qid) === String(q.id)) && !q.context_id);
                        const p1HasQ = part1.some(q => qIds.some(qid => String(qid) === String(q.id)) && !q.context_id);
                        if (p2HasQ && !p1HasQ && !p3HasQ)
                            item.part = 'part2';
                        else if (p3HasQ && !p1HasQ && !p2HasQ)
                            item.part = 'part3';
                        else if (p1HasQ && !p2HasQ && !p3HasQ)
                            item.part = 'part1';
                        else
                            item.part = 'part1';
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
                pList.forEach((q) => {
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
async function parseFullExamWithGemini(rawText) {
    const contents = `${basePrompt}\n\nNội dung đề thi:\n${rawText}`;
    try {
        const text = await callGeminiWithRetry(contents);
        const examData = JSON.parse(text);
        return normalizeExamData(examData);
    }
    catch (error) {
        console.error('Lỗi khi bóc tách đề thi với Gemini (text):', error);
        throw error;
    }
}
// ==========================================
// 2. HÀM GỌI GEMINI XỬ LÝ TỪ FILE (PDF/ẢNH)
// ==========================================
const parseFullExamFromFileWithGemini = async (file) => {
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
        const examData = JSON.parse(text);
        return normalizeExamData(examData);
    }
    catch (error) {
        console.error('Lỗi khi bóc tách file với Gemini:', error);
        throw error;
    }
};
exports.parseFullExamFromFileWithGemini = parseFullExamFromFileWithGemini;
async function generateWithFallback(prompt) {
    let lastError = null;
    for (const modelName of MODEL_FALLBACK_CHAIN) {
        try {
            const response = await ai.models.generateContent({
                model: modelName,
                contents: prompt,
            });
            if (response.text) {
                return response.text;
            }
        }
        catch (error) {
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
const explainErrorWithAI = async (prompt) => {
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
    }
    catch (error) {
        console.error('Lỗi khi gọi AI Service:', error);
        throw error;
    }
};
exports.explainErrorWithAI = explainErrorWithAI;
// ==========================================
// 3. HÀM TẠO ĐỀ THI MỚI TỰ ĐỘNG BẰNG AI (GENERATIVE)
// ==========================================
async function generateExamWithGemini(params) {
    const subject = params.subject || 'Toán Học';
    const grade = params.grade || '12';
    const topic = params.topic || 'Tổng hợp kiến thức';
    const p1Count = params.questionCount?.part1 !== undefined ? Number(params.questionCount.part1) : 12;
    const p2Count = params.questionCount?.part2 !== undefined ? Number(params.questionCount.part2) : 4;
    const p3Count = params.questionCount?.part3 !== undefined ? Number(params.questionCount.part3) : 6;
    const difficulty = params.difficulty || 'DIFFERENTIATED';
    const duration = params.durationMinutes || 50;
    const additional = params.additionalPrompt ? `\nYêu cầu bổ sung từ giáo viên:\n${params.additionalPrompt}` : '';
    const isEnglish = subject.toLowerCase().includes('anh') || subject.toLowerCase().includes('english');
    const prompt = `
Bạn là một chuyên gia khảo thí và giáo viên hàng đầu về soạn đề thi chuẩn THPT Quốc gia theo chương trình mới của Bộ Giáo dục & Đào tạo.
Nhiệm vụ: Tạo một đề thi hoàn chỉnh, chất lượng cao, chuẩn cấu trúc dựa trên các thông số sau:
- Môn học: ${subject}
- Khối lớp: Lớp ${grade}
- Chủ đề / Trọng tâm kiến thức: ${topic}
- Mức độ đề: ${difficulty} (Dễ: nhận biết, Trung bình: thông hiểu, Khó: vận dụng, Phân hóa: cấu trúc phân hóa chuẩn THPT)
- Thời gian làm bài: ${duration} phút
${additional}

CẤU TRÚC PHẦN THI BẮT BUỘC:
${isEnglish ? `
- ĐỀ THI TIẾNG ANH: Toàn bộ câu hỏi đưa vào 'part1' (tổng cộng ${p1Count || 40} câu trắc nghiệm 4 lựa chọn A, B, C, D). Để 'part2' và 'part3' là mảng rỗng [].
- Nếu có bài đọc hiểu (Reading Comprehension / Cloze Test), đưa đoạn văn đọc hiểu chung vào 'shared_context' (với id, content, questionIds, part: 'part1'), và các câu hỏi con tương ứng nằm trong 'part1'.
` : `
- Phần 1 (part1): Tạo chính xác ${p1Count} câu hỏi Trắc nghiệm nhiều lựa chọn (4 lựa chọn A, B, C, D). Đánh số id từ 1 đến ${p1Count}.
- Phần 2 (part2): Tạo chính xác ${p2Count} câu hỏi Trắc nghiệm Đúng/Sai. Đánh số id từ 1 đến ${p2Count}. Mỗi câu BẮT BUỘC có đúng 4 mệnh đề [a, b, c, d].
- Phần 3 (part3): Tạo chính xác ${p3Count} câu hỏi Trắc nghiệm Trả lời ngắn (kết quả là số hoặc giá trị ngắn gọn). Đánh số id từ 1 đến ${p3Count}.
- Nếu có ngữ liệu chung (đồ thị, bảng số liệu, đoạn văn), đưa vào 'shared_context' với 'id', 'content', 'questionIds', 'part'.
`}

QUY TẮC BẮT BUỘC:
1. ĐÁP ÁN VÀ LỜI GIẢI:
   - BẮT BUỘC giải chi tiết và điền đáp án chuẩn xác vào 'correctAnswer':
     + Phần 1: 'correctAnswer' CHỈ điền một trong các chữ cái 'A', 'B', 'C', hoặc 'D'.
     + Phần 2: 'correctAnswer' là object chứa đúng 4 key: { "a": "Đ" hoặc "S", "b": "Đ" hoặc "S", "c": "Đ" hoặc "S", "d": "Đ" hoặc "S" }.
     + Phần 3: 'correctAnswer' là chuỗi kết quả ngắn gọn (ví dụ: "12", "-4.5", "1/3").
   - Viết lời giải / giải thích súc tích vào trường 'explanation' (hoặc 'solution' cho Phần 3).
2. LATEX VÀ TRÌNH BÀY:
   - Mọi công thức Toán, Lý, Hóa BẮT BUỘC bọc trong cặp dấu $ $ (ví dụ: $x^2 + 2x - 3 = 0$).
   - KHÔNG dùng bảng LaTeX \\begin{array} hay \\begin{tabular}. Trình bày bảng bằng văn bản thuần.
3. PHÂN LOẠI:
   - Ghi rõ 'topic' và 'difficulty' ('EASY' | 'MEDIUM' | 'HARD') cho từng câu.
4. ĐỊNH DẠNG:
   - Trả về dữ liệu chuẩn JSON tuân theo schema đã cung cấp.
`;
    const text = await callGeminiWithRetry(prompt);
    const examData = JSON.parse(text);
    return normalizeExamData(examData);
}
// ==========================================
// 4. HÀM TẠO LẠI 1 CÂU HỎI BẰNG AI (REGENERATE QUESTION)
// ==========================================
async function regenerateQuestionWithGemini(params) {
    const target = params.targetQuestion;
    if (!target)
        throw new Error('Thiếu thông tin câu hỏi cần tạo lại (targetQuestion).');
    const part = target.part || 'part1';
    const subject = params.subject || 'Toán Học';
    const grade = params.grade || '12';
    const topic = params.topic || target.currentQuestion?.topic || 'Chung';
    const difficulty = params.difficulty || target.currentQuestion?.difficulty || 'MEDIUM';
    const prompt = `
Bạn là chuyên gia khảo thí THPT. Hãy tạo MỘT câu hỏi MỚI hoàn toàn để thay thế câu hỏi trong đề thi:
- Môn: ${subject}, Khối: Lớp ${grade}
- Phần: ${part.toUpperCase()}
- Chủ đề: ${topic}
- Mức độ: ${difficulty}
${part === 'part1' ? `
- Cấu trúc Phần 1: Trắc nghiệm 4 lựa chọn (A, B, C, D). 
- 'options' phải có đủ 4 lựa chọn A, B, C, D.
- 'correctAnswer' chỉ là một trong ['A', 'B', 'C', 'D'].
- Trả về câu hỏi này trong mảng 'part1' (mảng 'part2' và 'part3' để rỗng).
` : part === 'part2' ? `
- Cấu trúc Phần 2: Trắc nghiệm Đúng/Sai với chính xác 4 mệnh đề a, b, c, d.
- 'statements' có đủ a, b, c, d.
- 'correctAnswer' là { a: 'Đ'|'S', b: 'Đ'|'S', c: 'Đ'|'S', d: 'Đ'|'S' }.
- Trả về câu hỏi này trong mảng 'part2' (mảng 'part1' và 'part3' để rỗng).
` : `
- Cấu trúc Phần 3: Trắc nghiệm Trả lời ngắn.
- 'correctAnswer' là kết quả số hoặc chuỗi ngắn gọn.
- Trả về câu hỏi này trong mảng 'part3' (mảng 'part1' và 'part2' để rỗng).
`}
- Kèm trường 'explanation' giải thích phương pháp giải.
- Công thức Toán/Khoa học bọc trong $ $.
- Trả về JSON theo đúng schema.
`;
    const text = await callGeminiWithRetry(prompt);
    const examData = JSON.parse(text);
    const normalized = normalizeExamData(examData);
    const list = normalized[part];
    if (list && list.length > 0) {
        const newQ = { ...list[0], id: target.id };
        return newQ;
    }
    throw new Error('AI không tạo được câu hỏi thay thế hợp lệ.');
}
//# sourceMappingURL=geminiService.js.map