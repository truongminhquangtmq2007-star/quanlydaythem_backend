const fs = require('fs');
let code = fs.readFileSync('src/services/geminiService.ts', 'utf8');

// Fix pdfParse
code = code.replace("import pdfParse from 'pdf-parse';", "const pdfParse = require('pdf-parse');");

// Fix duplicate variables
const parts = code.split('const MODEL_FALLBACK_CHAIN');
if (parts.length > 2) {
    // Remove the second one
    code = code.replace(/const MODEL_FALLBACK_CHAIN = \[[^\]]+\];/g, (match, offset) => {
        return offset > 1000 ? '' : match; // only keep the first one at the top
    });
}
const parts2 = code.split('const MAX_RETRIES_PER_MODEL');
if (parts2.length > 2) {
    code = code.replace(/const MAX_RETRIES_PER_MODEL = 3;/g, (match, offset) => {
        return offset > 1000 ? '' : match;
    });
}

// Fix TAXONOMIES
if (!code.includes('const TAXONOMIES')) {
    const tax = `
const TAXONOMIES = {
  "Toán Học": ["Đại Số", "Hình Học", "Lượng Giác", "Giải Tích"],
  "Vật Lý": ["Cơ Học", "Nhiệt Học", "Điện Từ Học", "Quang Học", "Vật Lý Lượng Tử"],
  "Hóa Học": ["Vô Cơ", "Hữu Cơ", "Hóa Lý", "Hóa Phân Tích"],
  "Sinh Học": ["Tế Bào", "Di Truyền", "Tiến Hóa", "Sinh Thái"],
  "Tiếng Anh": ["Ngữ Pháp", "Từ Vựng", "Đọc Hiểu", "Viết"]
};
`;
    code = code.replace('const basePrompt = `', tax + '\nconst basePrompt = `');
}

fs.writeFileSync('src/services/geminiService.ts', code);
console.log("Patched syntax errors");

