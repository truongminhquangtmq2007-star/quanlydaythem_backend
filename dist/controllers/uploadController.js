"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadDocument = exports.uploadImage = void 0;
const cloudinary_1 = require("cloudinary");
const multer_1 = __importDefault(require("multer"));
const multer_storage_cloudinary_1 = require("multer-storage-cloudinary");
// Middleware cấu hình upload
const uploadImage = (req, res) => {
    // 1. Kiểm tra biến môi trường
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        res.status(500).json({ message: 'Thiếu cấu hình Cloudinary (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)' });
        return;
    }
    // 2. Cấu hình Cloudinary
    cloudinary_1.v2.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
    // 3. Cấu hình Storage
    const storage = new multer_storage_cloudinary_1.CloudinaryStorage({
        cloudinary: cloudinary_1.v2,
        params: {
            folder: 'exam_questions',
            allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'webp']
        }
    });
    const parser = (0, multer_1.default)({ storage: storage }).single('image');
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
exports.uploadImage = uploadImage;
const uploadDocument = (req, res) => {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        res.status(500).json({ message: 'Thiếu cấu hình Cloudinary' });
        return;
    }
    cloudinary_1.v2.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
    const storage = new multer_storage_cloudinary_1.CloudinaryStorage({
        cloudinary: cloudinary_1.v2,
        params: {
            folder: 'documents',
            resource_type: 'auto'
        }
    });
    const parser = (0, multer_1.default)({ storage: storage }).single('file');
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
exports.uploadDocument = uploadDocument;
//# sourceMappingURL=uploadController.js.map