const fs = require('fs');
let code = fs.readFileSync('src/controllers/uploadController.ts', 'utf8');

const newCode = `
export const uploadDocument = (req: Request, res: Response) => {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        res.status(500).json({ message: 'Thiếu cấu hình Cloudinary' });
        return;
    }

    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });

    const storage = new CloudinaryStorage({
        cloudinary: cloudinary,
        params: {
            folder: 'documents',
            resource_type: 'auto'
        } as any
    });

    const parser = multer({ storage: storage }).single('file');

    parser(req, res, function (err) {
        if (err) {
            console.error('Lỗi upload document Cloudinary:', err);
            return res.status(500).json({ message: 'Lỗi khi upload tài liệu', detail: err.message });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'Không tìm thấy file' });
        }

        res.status(200).json({ secure_url: req.file.path });
    });
};
`;

code += '\n' + newCode;
fs.writeFileSync('src/controllers/uploadController.ts', code);
console.log('Added uploadDocument');

