"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadMemory = exports.uploadCloud = void 0;
const cloudinary_1 = require("cloudinary");
const multer_storage_cloudinary_1 = require("multer-storage-cloudinary");
const multer_1 = __importDefault(require("multer"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Khởi tạo kết nối với Cloudinary
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
// ========================================================
// 1. KHO LƯU CLOUDINARY (Dùng cho upload tài liệu, lưu ảnh câu hỏi)
// ========================================================
const cloudStorage = new multer_storage_cloudinary_1.CloudinaryStorage({
    cloudinary: cloudinary_1.v2,
    params: async (req, file) => {
        return {
            folder: 'tai_lieu_lms',
            resource_type: 'auto',
            public_id: `${Date.now()}-${file.originalname}`
        };
    },
});
// Đổi tên thành uploadCloud để dễ phân biệt
exports.uploadCloud = (0, multer_1.default)({ storage: cloudStorage });
// ========================================================
// 2. KHO LƯU RAM (Dùng RIÊNG cho Gemini AI bóc tách đề)
// ========================================================
const memoryStorage = multer_1.default.memoryStorage();
exports.uploadMemory = (0, multer_1.default)({ storage: memoryStorage });
//# sourceMappingURL=uploadMiddleware.js.map