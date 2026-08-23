const fs = require('fs');

let code = fs.readFileSync('src/controllers/studentController.ts', 'utf8');

if (!code.includes('generateWithFallback')) {
  code = "import { generateWithFallback } from '../services/geminiService';\n" + code;
}

if (!code.includes('export const generateAIEvaluation')) {
  const newFunc = `
export const generateAIEvaluation = async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
        // 1. Get student profile
        const studentRes = await pool.query('SELECT full_name, school_name, is_active FROM students WHERE id = $1', [id]);
        if (studentRes.rows.length === 0) {
            res.status(404).json({ message: "Không tìm thấy học sinh" });
            return;
        }
        const student = studentRes.rows[0];

        // 2. Get recent exams
        const examsRes = await pool.query(\`
            SELECT total_score, time_taken_seconds, topic_performance 
            FROM exam_submissions 
            WHERE student_id = $1 AND status = 'COMPLETED'
            ORDER BY submitted_at DESC 
            LIMIT 5
        \`, [id]);
        
        let examsContext = 'Học sinh chưa làm bài tập/thi nào.';
        if (examsRes.rows.length > 0) {
            examsContext = examsRes.rows.map((e, idx) => {
                let perfStr = 'Không có dữ liệu dạng bài';
                if (e.topic_performance) {
                   perfStr = JSON.stringify(e.topic_performance);
                }
                return \`Bài \${idx + 1}: Điểm \${e.total_score} - Thời gian \${e.time_taken_seconds}s - Thống kê: \${perfStr}\`;
            }).join('\\n');
        }

        // 3. Get attendance
        const attendanceRes = await pool.query('SELECT status, COUNT(*) as count FROM attendance WHERE student_id = $1 GROUP BY status', [id]);
        let total_sessions = 0;
        let present = 0;
        attendanceRes.rows.forEach(row => {
            const cnt = parseInt(row.count);
            total_sessions += cnt;
            if (row.status === 'PRESENT') present += cnt;
        });
        const attRate = total_sessions > 0 ? Math.round((present / total_sessions) * 100) : 0;

        // 4. Construct Prompt
        const prompt = \`Bạn là một giáo viên tận tâm. Dựa vào dữ liệu học tập sau của học sinh \${student.full_name} (Trường: \${student.school_name || 'Không rõ'}, Trạng thái: \${student.is_active ? 'Đang học' : 'Nghỉ học'}):
Tỷ lệ đi học: \${total_sessions > 0 ? \`\${attRate}% (\${present}/\${total_sessions} buổi)\` : 'Chưa có dữ liệu điểm danh'}
Lịch sử làm bài (gần nhất):
\${examsContext}

Hãy phân tích và trả về DUY NHẤT một chuỗi JSON chuẩn xác (không bọc trong markdown tick) với cấu trúc:
{ "strong_points": ["..."], "weak_points": ["..."], "attention_note": "...", "action_plan": "...", "analyzed_at": "YYYY-MM-DD" }\`;

        // 5. Call AI
        let aiText = await generateWithFallback(prompt);
        // Clean markdown backticks if AI ignores prompt instructions
        aiText = aiText.replace(/\\s*\`\`\`json\\s*/g, '').replace(/\\s*\`\`\`\\s*/g, '').trim();

        const parsedAIResponse = JSON.parse(aiText);
        // Add analyzed_at if missing
        if (!parsedAIResponse.analyzed_at) {
            parsedAIResponse.analyzed_at = new Date().toISOString().split('T')[0];
        }

        // 6. Save to DB
        await pool.query('UPDATE students SET ai_evaluation = $1 WHERE id = $2', [JSON.stringify(parsedAIResponse), id]);

        res.status(200).json({ message: "Phân tích thành công", data: parsedAIResponse, ai_evaluation: parsedAIResponse });
    } catch (error) {
        console.error('Lỗi generateAIEvaluation:', error);
        res.status(500).json({ message: 'Lỗi server khi phân tích AI' });
    }
};
`;
  code += '\n' + newFunc;
  fs.writeFileSync('src/controllers/studentController.ts', code);
  console.log('Added generateAIEvaluation to studentController.ts');
}

