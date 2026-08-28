"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.explainErrorWithAI = void 0;
const genai_1 = require("@google/genai");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Khởi tạo Gemini AI từ @google/genai SDK
const ai = new genai_1.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
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
//# sourceMappingURL=aiService.js.map