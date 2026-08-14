import { Pool } from 'pg';
import dotenv from 'dotenv';

// Tải các biến môi trường từ file .env
dotenv.config();
console.log("Mật khẩu đang đọc được là:", process.env.DB_PASSWORD);

// Khởi tạo một "hồ bơi" (Pool) chứa các kết nối tới cơ sở dữ liệu
const pool = new Pool({

  connectionString: process.env.DATABASE_URL,
  
  // BẮT BUỘC PHẢI THÊM ĐOẠN SSL NÀY
  ssl: {
    rejectUnauthorized: false
  },
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Kiểm tra kết nối
pool.connect()
  .then(() => console.log('✅ Đã kết nối thành công với cơ sở dữ liệu PostgreSQL!'))
  .catch((err) => console.error('❌ Lỗi kết nối CSDL:', err.message));

export default pool;