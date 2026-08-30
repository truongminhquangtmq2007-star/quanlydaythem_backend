const fs = require('fs');

const targetPath = 'src/controllers/examController.ts';
let code = fs.readFileSync(targetPath, 'utf8');

if (!code.includes("import { v2 as cloudinary } from 'cloudinary';")) {
  code = "import { v2 as cloudinary } from 'cloudinary';\n" + code;
}

// Find the line where it says: const file = (req as any).file;
// and insert the upload logic right after the `if (!file) { ... }` block
const fileCheckRegex = /if \(!file\) \{\s*res\.status\(400\)\.json\(\{ message: 'Không tìm thấy file tải lên!' \}\);\s*return;\s*\}/;

const uploadLogic = `
        let secure_url = '';
        try {
            secure_url = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    { folder: 'documents', resource_type: 'auto' },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result.secure_url);
                    }
                );
                uploadStream.end(file.buffer);
            });
        } catch (uploadError) {
            console.error('Cloudinary upload error:', uploadError);
            res.status(500).json({ message: 'Lỗi tải file lên máy chủ lưu trữ (Cloudinary).' });
            return;
        }

        if (!secure_url) {
            res.status(500).json({ message: 'Không lấy được URL file.' });
            return;
        }
`;

code = code.replace(fileCheckRegex, (match) => {
    return match + '\n' + uploadLogic;
});

// Now replace file.path with secure_url in the INSERT query
const insertRegex = /\[file\.originalname \|\| 'Đề thi tự động tạo', file\.path, folderId\]/g;
code = code.replace(insertRegex, "[file.originalname || 'Đề thi tự động tạo', secure_url, folderId]");

fs.writeFileSync(targetPath, code);
console.log("Patched via regex");

