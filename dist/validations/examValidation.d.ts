export interface ExamValidationError {
    field: string;
    message: string;
    part?: string;
    question_id?: number | string;
}
export interface ExamValidationResult {
    isValid: boolean;
    errors: ExamValidationError[];
    sanitizedExam?: any;
}
export declare function sanitizeText(text: any): string;
export declare function normalizeTrueFalseValue(val: any): 'Đ' | 'S' | '';
export declare function validateAndSanitizeExam(examData: any): ExamValidationResult;
//# sourceMappingURL=examValidation.d.ts.map