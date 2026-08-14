import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors'; // Giữ lại 1 dòng import CORS duy nhất
import dotenv from 'dotenv';
import './db'; 
import fs from 'fs';
import studentRoutes from './routes/studentRoutes'; 
import classRoutes from './routes/classRoutes';
import enrollmentRoutes from './routes/enrollmentRoutes';
import attendanceRoutes from './routes/attendanceRoutes';
import paymentRoutes from './routes/paymentRoutes';
import authRoutes from './routes/authRoutes';
import documentRoutes from './routes/documentRoutes';
import folderRoutes from './routes/folderRoutes';
import sessionRoutes from './routes/sessionRoutes';
import examRoutes from './routes/examRoutes';

console.log("Danh sách các file đang có ở thư mục gốc:", fs.readdirSync(process.cwd()));
console.log("Mật khẩu đọc được lúc này là:", process.env.DB_PASSWORD);

const app = express();

// SỬA QUAN TRỌNG: Để Render tự động cấp cổng
const PORT = process.env.PORT || 5000;

// Bật CORS đầy đủ cấu hình
app.use(cors({
  origin: '*',
  credentials: true
}));

app.use(express.json());

// Khai báo các Routes
app.use('/api/students', studentRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/bills', paymentRoutes); 
app.use('/api/exams', examRoutes);

// Đường dẫn gốc
app.get('/', (req: Request, res: Response) => {
  res.send('Chào mừng đến với máy chủ Quản lý dạy thêm!');
});

// API kiểm tra
app.use('/api/kiem-tra', (req: Request, res: Response) => {
  res.json({ message: 'Xin chào! Backend của hệ thống quản lý học tập đã hoạt động hoàn hảo!' });
});

// Chạy máy chủ
app.listen(PORT, () => {
  console.log(`🚀 Server Backend đang chạy thành công tại cổng: ${PORT}`);
});