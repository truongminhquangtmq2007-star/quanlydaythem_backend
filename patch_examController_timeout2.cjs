const fs = require('fs');
let code = fs.readFileSync('src/controllers/examController.ts', 'utf8');

const regex = /catch\s*\(error:\s*any\)\s*\{\s*console\.error\([^\)]*\);\s*res\.status\(500\)\.json\(\{\s*message:[^\}]*\}\);/g;

const catchBlockNew = `catch (error: any) {
        console.error('Lỗi nhận và xử lý file:', error);
        const errMessage = String(error.message || error);
        if (errMessage.includes('fetch failed') || errMessage.includes('TIMEOUT') || errMessage.includes('timeout')) {
            res.status(504).json({ status: "error", message: "File quá dài hoặc AI đang quá tải, phản hồi quá lâu. Vui lòng chia nhỏ file hoặc thử lại sau." });
            return;
        }
        res.status(500).json({ message: 'Lỗi server khi AI xử lý file', detail: error.message });`;

code = code.replace(/catch \(error: any\) \{\s*console\.error\([^,]+, error\);\s*res\.status\(500\)\.json\(\{ message: '[^']+', detail: error\.message \}\);/, catchBlockNew);

fs.writeFileSync('src/controllers/examController.ts', code);
console.log('Patched examController with regex');
