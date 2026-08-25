import { Request, Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

// Middleware cấu hình upload
export const uploadImage = (req: Request, res: Response) => {
    // 1. Kiểm tra biến môi trường
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        res.status(500).json({ message: 'Thiếu cấu hình Cloudinary (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)' });
        return;
    }

    // 2. Cấu hình Cloudinary
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });

    // 3. Cấu hình Storage
    const storage = new CloudinaryStorage({
        cloudinary: cloudinary,
        params: {
            folder: 'exam_questions',
            allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'webp']
        } as any
    });

    const parser = multer({ storage: storage }).single('image');

    // 4. Xử lý upload
    parser(req, res, function (err) {
        if (err) {
            console.error('Lỗi upload Cloudinary:', err);
            return res.status(500).json({ message: 'Lỗi khi upload ảnh lên Cloud', detail: err.message });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'Không tìm thấy file ảnh trong request' });
        }

        // multer-storage-cloudinary gán URL vào req.file.path
        res.status(200).json({ url: req.file.path });
    });
};

