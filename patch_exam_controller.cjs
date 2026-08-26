const fs = require('fs');
let code = fs.readFileSync('src/controllers/examController.ts', 'utf8');

const oldParseFunctionRegex = /export const parseExamFromFile = async \(req: AuthRequest, res: Response\): Promise<void> => \{[\s\S]*?\}\s*catch\s*\(error:\s*any\)\s*\{[\s\S]*?res\.status\(500\)\.json\(\{ message: 'Lỗi server khi AI xử lý file', detail: error\.message \}\);\s*\}\s*\};/;

const newParseFunction = `export const parseExamFromFile = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { document_id, class_id, durationMinutes } = req.body;
        const file = (req as any).file; 

        if (!file) {
            res.status(400).json({ message: 'Không tìm thấy file tải lên!' });
            return;
        }

        // 1. LUÔN LUÔN tạo document TRƯỚC
        let actual_document_id = document_id;
        let folderId = null;
        if (!actual_document_id) {
            // Find EXAM folder for this class_id
            if (class_id) {
                const folderCheck = await pool.query("SELECT id FROM folders WHERE class_id = $1 AND category = 'EXAM'", [class_id]);
                if (folderCheck.rows.length > 0) {
                    folderId = folderCheck.rows[0].id;
                } else {
                    const newFolder = await pool.query(
                        "INSERT INTO folders (name, category, class_id) VALUES ('Đề thi', 'EXAM', $1) RETURNING id",
                        [class_id]
                    );
                    folderId = newFolder.rows[0].id;
                }
            }
            
            const docRes = await pool.query(
                \`INSERT INTO documents (title, file_url, category, folder_id) VALUES ($1, $2, 'EXAM', $3) RETURNING id\`,
                [file.originalname || 'Đề thi tự động tạo', file.path, folderId]
            );
            actual_document_id = docRes.rows[0].id;
        }

        console.log('--- ĐANG GỌI FILE CHO GEMINI AI XỬ LÝ ---');
        
        let fullExam = null;
        let part1Key = {};
        let part2Key = {};
        let part3Key = {};

        // 2. Gọi AI trong try-catch
        try {
            fullExam = await parseFullExamFromFileWithGemini(file);
            part1Key = fullExam.part1.reduce((acc: any, q: any) => { acc[q.id] = q.correctAnswer; return acc; }, {});
            part2Key = fullExam.part2.reduce((acc: any, q: any) => { acc[q.id] = q.correctAnswer; return acc; }, {});
            part3Key = fullExam.part3.reduce((acc: any, q: any) => { acc[q.id] = q.correctAnswer; return acc; }, {});
            console.log('--- XỬ LÝ FILE HOÀN TẤT ---');
        } catch (aiError: any) {
            console.error('Lỗi Gemini AI timeout hoặc 429:', aiError);
            res.status(200).json({ 
                message: 'Lưu đề thi thành công! (Lưu ý: AI bóc tách thất bại do quá tải, vui lòng nhập câu hỏi thủ công)',
                examKey: {
                    part1_key: {},
                    part2_key: {},
                    part3_key: {},
                    document_id: actual_document_id,
                    class_id: class_id,
                    duration_minutes: durationMinutes || 50
                },
                examContent: { part1: [], part2: [], part3: [] }
            });
            return;
        }

        res.status(200).json({ 
            message: 'Phân tích file bằng AI thành công! Vui lòng kiểm tra và chỉnh sửa trước khi lưu.',
            examKey: {
                part1_key: part1Key,
                part2_key: part2Key,
                part3_key: part3Key,
                document_id: actual_document_id,
                class_id: class_id,
                duration_minutes: durationMinutes || 50
            },
            examContent: fullExam
        });
    } catch (error: any) {
        console.error('Lỗi nhận và xử lý file:', error);
        res.status(500).json({ message: 'Lỗi server khi xử lý file', detail: error.message });
    }
};`;

// Use fallback logic if regex fails due to character mismatch
if (oldParseFunctionRegex.test(code)) {
    code = code.replace(oldParseFunctionRegex, newParseFunction);
} else {
    // simpler replace
    const splitStr = 'export const parseExamFromFile = async (req: AuthRequest, res: Response): Promise<void> => {';
    const parts = code.split(splitStr);
    if (parts.length > 1) {
        const afterPart = parts[1];
        const nextFunctionStr = '\nexport const getAllExams';
        const insideParts = afterPart.split(nextFunctionStr);
        code = parts[0] + newParseFunction + nextFunctionStr + insideParts[1];
    }
}

fs.writeFileSync('src/controllers/examController.ts', code);
console.log("Patched parseExamFromFile in examController.ts");

