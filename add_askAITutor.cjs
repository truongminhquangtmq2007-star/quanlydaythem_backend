const fs = require('fs');

let code = fs.readFileSync('src/controllers/examController.ts', 'utf8');

const tutorCode = `
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

export const askAITutor = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const studentId = req.user?.id;
        const { exam_id, question_id, student_question } = req.body;

        if (!studentId || !exam_id || !question_id || !student_question) {
            res.status(400).json({ message: 'Thiếu thông tin cần thiết' });
            return;
        }

        // Lấy thông tin bài thi của học sinh
        const submissionRes = await pool.query(
            "SELECT student_answers, detailed_results FROM exam_submissions WHERE student_id = $1 AND (document_id = $2 OR exam_id = $2) AND status = 'COMPLETED'",
            [studentId, exam_id]
        );

        if (submissionRes.rows.length === 0) {
            res.status(404).json({ message: 'Không tìm thấy kết quả làm bài của bạn.' });
            return;
        }

        const submission = submissionRes.rows[0];
        const detailedResults = submission.detailed_results || [];
        const questionDetail = detailedResults.find((q: any) => String(q.question_id) === String(question_id));

        // Lấy đề và đáp án chuẩn
        const keyRes = await pool.query("SELECT exam_content FROM exam_keys WHERE document_id = $1", [exam_id]);
        if (keyRes.rows.length === 0) {
            res.status(404).json({ message: 'Không tìm thấy dữ liệu đề thi.' });
            return;
        }

        const examContent = keyRes.rows[0].exam_content || {};
        const allQuestions = [
            ...(examContent.part1 || []),
            ...(examContent.part2 || []),
            ...(examContent.part3 || [])
        ];

        const qData = allQuestions.find((q: any) => String(q.id) === String(question_id));

        if (!qData) {
            res.status(404).json({ message: 'Không tìm thấy câu hỏi.' });
            return;
        }

        const subTopic = qData.sub_topic || qData.topic || 'Chưa phân loại';
        const questionContent = qData.questionText || '';
        const correctAnswer = questionDetail?.correct_answer || qData.correctAnswer || '';
        const studentAnswer = questionDetail?.student_answer || 'Không trả lời';
        const solutionText = qData.solution || qData.explanation || 'Không có lời giải chi tiết';

        const prompt = \`Đóng vai một giáo viên Toán/Lý tận tâm. Học sinh đang hỏi về 1 câu thuộc chuyên đề \${subTopic}.
Nội dung câu hỏi: \${questionContent}.
Đáp án đúng là: \${JSON.stringify(correctAnswer)}.
Học sinh đã chọn đáp án: \${JSON.stringify(studentAnswer)}.
Lời giải tham khảo: \${solutionText}.

Câu hỏi của học sinh: "\${student_question}"

Nhiệm vụ của bạn: Dựa vào lời giải chuẩn, hãy giải thích NGẮN GỌN, DỄ HIỂU, tập trung trả lời đúng vào thắc mắc của học sinh. Chỉ ra vì sao đáp án của học sinh bị sai (bắt bệnh tư duy). Trình bày bằng Markdown, sử dụng LaTeX cho công thức toán học (bọc trong dấu $ hoặc $$). Định hướng giải thích: Nếu là Toán/Lý 12 thì hướng tới cách giải nhanh trắc nghiệm cùng với bản chất lý thuyết; nếu là Lý 11 thì phân tích sâu hiện tượng vật lí. Tránh tình trạng học sinh học vẹt, nội dung câu trả lời không được lan man nhưng phải có bản chất, được đi kèm với mẹo giải nhanh nhưng chỉ là yếu tố phụ đi kèm.\`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
        });

        res.status(200).json({ answer: response.text });
    } catch (error) {
        console.error('Lỗi askAITutor:', error);
        res.status(500).json({ message: 'Lỗi AI Tutor', detail: (error as Error).message });
    }
};
`;

code += '\n' + tutorCode;
fs.writeFileSync('src/controllers/examController.ts', code);
console.log('Added askAITutor');

