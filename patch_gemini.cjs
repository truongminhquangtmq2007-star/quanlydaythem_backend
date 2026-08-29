const fs = require('fs');

const file = 'src/services/geminiService.ts';
let code = fs.readFileSync(file, 'utf8');

const explainFunc = `
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
        throw new Error(\`AI Provider \${provider} chưa được hỗ trợ.\`);
    } catch (error) {
        console.error('Lỗi khi gọi AI Service:', error);
        throw error;
    }
};
`;

code = code + '\n' + explainFunc;
fs.writeFileSync(file, code);

// Now patch reportController.ts
const reportFile = 'src/controllers/reportController.ts';
let reportCode = fs.readFileSync(reportFile, 'utf8');
reportCode = reportCode.replace("import { explainErrorWithAI } from '../services/ai/aiService';", "import { explainErrorWithAI } from '../services/geminiService';");
fs.writeFileSync(reportFile, reportCode);

console.log('AI Services consolidated.');
