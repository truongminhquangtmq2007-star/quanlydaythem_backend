/**
 * AI Router: Hàm này có thể mở rộng để gọi OpenAI/Claude sau này
 * dựa trên biến môi trường (vd: process.env.AI_PROVIDER).
 * Hiện tại mặc định sử dụng Google Gemini (gemini-2.5-flash).
 */
export declare const explainErrorWithAI: (prompt: string) => Promise<string>;
//# sourceMappingURL=aiService.d.ts.map