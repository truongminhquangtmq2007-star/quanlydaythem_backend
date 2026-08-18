import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import dotenv from 'dotenv';

dotenv.config();

// Khởi tạo kết nối với Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ========================================================
// 1. KHO LƯU CLOUDINARY (Dùng cho upload tài liệu, lưu ảnh câu hỏi)
// ========================================================
const cloudStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: 'tai_lieu_lms', 
      resource_type: 'auto', 
      public_id: `${Date.now()}-${file.originalname}` 
    };
  },
});
// Đổi tên thành uploadCloud để dễ phân biệt
export const uploadCloud = multer({ storage: cloudStorage });


// ========================================================
// 2. KHO LƯU RAM (Dùng RIÊNG cho Gemini AI bóc tách đề)
// ========================================================
const memoryStorage = multer.memoryStorage();
export const uploadMemory = multer({ storage: memoryStorage });