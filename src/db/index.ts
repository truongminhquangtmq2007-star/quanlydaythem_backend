import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
});

// ⚠️ QUAN TRỌNG: Bắt lỗi trên các kết nối rảnh (idle) trong Pool
// Nếu không có đoạn này, khi Neon tự ngắt kết nối rảnh, 
// cả server Node.js sẽ bị crash hoàn toàn (Unhandled error).
pool.on('error', (err) => {
  console.error('⚠️ Lỗi không mong muốn trên kết nối rảnh của Pool:', err.message);
  // Không throw lại lỗi ở đây — chỉ log ra, để server tiếp tục sống
});

pool.query('SELECT NOW()')
  .then(() => console.log('✅ Đã kết nối thành công với cơ sở dữ liệu PostgreSQL!'))
  .catch((err) => console.error('❌ Lỗi kết nối CSDL:', err.message));

export default pool;