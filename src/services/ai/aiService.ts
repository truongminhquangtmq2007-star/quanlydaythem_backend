import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

// Khởi tạo Gemini AI từ @google/genai SDK
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

