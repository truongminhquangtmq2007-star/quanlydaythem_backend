import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import dotenv from 'dotenv';

dotenv.config();

// Khởi tạo kết nối với Cloudinary bằng các khóa trong file .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Cấu hình kho lưu trữ
// Cấu hình kho lưu trữ
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: 'tai_lieu_lms', 
      resource_type: 'auto', 
      
      // [ĐÃ SỬA]: Giữ nguyên file.originalname để không bị mất đuôi .xlsx, .docx
      public_id: `${Date.now()}-${file.originalname}` 
    };
  },
});

// Xuất ra biến upload để dùng như một middleware chặn ở các Route
export const upload = multer({ storage: storage });