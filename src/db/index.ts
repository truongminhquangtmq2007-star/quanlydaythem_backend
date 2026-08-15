import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // Bỏ ssl vì đang chạy local, không cần SSL với localhost
});

pool.connect()
  .then(() => console.log('✅ Đã kết nối thành công với cơ sở dữ liệu PostgreSQL!'))
  .catch((err) => console.error('❌ Lỗi kết nối CSDL:', err.message));

export default pool;