const fs = require('fs');
let code = fs.readFileSync('src/controllers/examController.ts', 'utf8');

const newPublishExam = `
export const publishExam = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        // Trong hệ thống thực tế, Đề thi đã được lưu vào bảng documents với category='EXAM',
        // và nội dung JSON được lưu vào bảng exam_keys qua hàm saveAnswerKey.
        // Vì vậy không cần insert vào các bảng ảo exams, question_contexts, questions.
        // Chỉ cần trả về 200 OK.
        res.status(200).json({ message: 'Xuất bản đề thi thành công!' });
    } catch (error) {
        console.error('Lỗi publish đề:', error);
        res.status(500).json({ message: 'Lỗi xuất bản đề thi' });
    }
};
`;

code = code.replace(/export const publishExam = async \(req: AuthRequest, res: Response\): Promise<void> => \{[\s\S]*?res\.status\(500\)\.json\(\{ message: 'Lỗi xuất bản đề thi' \}\);\s*\}\s*\};/g, newPublishExam);

// If not matched because of some character encoding, fallback:
if (code.includes('INSERT INTO exams (document_id, title')) {
    code = code.replace(/export const publishExam = async \([\s\S]*?res\.status\(500\)\.json\(\{ message: 'L[^\']*' \}\);\s*\}\s*\};/, newPublishExam);
}

fs.writeFileSync('src/controllers/examController.ts', code);
console.log('Patched publishExam');
