export interface MultipleChoiceQuestion {
    id: number;
    questionText: string;
    image_url?: string;
    options: {
        A: string;
        B: string;
        C: string;
        D: string;
    };
    correctAnswer: 'A' | 'B' | 'C' | 'D';
    context_id?: number;
}
export interface TrueFalseQuestion {
    id: number;
    questionText: string;
    image_url?: string;
    statements: {
        a: string;
        b: string;
        c: string;
        d: string;
    };
    correctAnswer: {
        a: 'Đ' | 'S';
        b: 'Đ' | 'S';
        c: 'Đ' | 'S';
        d: 'Đ' | 'S';
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
    shared_context?: SharedContext[];
    sharedContexts?: SharedContext[];
}
export declare function parseFullExamWithGemini(rawText: string): Promise<FullExamData>;
export declare const parseFullExamFromFileWithGemini: (file: Express.Multer.File) => Promise<FullExamData>;
export declare function generateWithFallback(prompt: string): Promise<string>;
/**
 * AI Router: Hàm này có thể mở rộng để gọi OpenAI/Claude sau này
 * dựa trên biến môi trường (vd: process.env.AI_PROVIDER).
 * Hiện tại mặc định sử dụng Google Gemini (gemini-2.5-flash).
 */
export declare const explainErrorWithAI: (prompt: string) => Promise<string>;
//# sourceMappingURL=geminiService.d.ts.map