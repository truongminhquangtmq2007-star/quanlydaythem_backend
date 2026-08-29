"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
require("./db");
const fs_1 = __importDefault(require("fs"));
const studentRoutes_1 = __importDefault(require("./routes/studentRoutes"));
const classRoutes_1 = __importDefault(require("./routes/classRoutes"));
const enrollmentRoutes_1 = __importDefault(require("./routes/enrollmentRoutes"));
const attendanceRoutes_1 = __importDefault(require("./routes/attendanceRoutes"));
const paymentRoutes_1 = __importDefault(require("./routes/paymentRoutes"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const calendarRoutes_1 = __importDefault(require("./routes/calendarRoutes"));
const documentRoutes_1 = __importDefault(require("./routes/documentRoutes"));
const folderRoutes_1 = __importDefault(require("./routes/folderRoutes"));
const sessionRoutes_1 = __importDefault(require("./routes/sessionRoutes"));
const examRoutes_1 = __importDefault(require("./routes/examRoutes"));
const assignmentRoutes_1 = __importDefault(require("./routes/assignmentRoutes"));
const analyticsRoutes_1 = __importDefault(require("./routes/analyticsRoutes"));
const aiRoutes_1 = __importDefault(require("./routes/aiRoutes"));
const reportRoutes_1 = __importDefault(require("./routes/reportRoutes"));
const uploadRoutes_1 = __importDefault(require("./routes/uploadRoutes"));
const studentPortalRoutes_1 = __importDefault(require("./routes/studentPortalRoutes"));
console.log("Danh sách các file đang có ở thư mục gốc:", fs_1.default.readdirSync(process.cwd()));
console.log("Mật khẩu đọc được lúc này là:", process.env.DB_PASSWORD);
const app = (0, express_1.default)();
// SỬA QUAN TRỌNG: Để Render tự động cấp cổng
// Bật CORS đầy đủ cấu hình
app.use((0, cors_1.default)({
    origin: 'https://quanlydaythem-frontend-dun.vercel.app',
    credentials: true
}));
app.use(express_1.default.json());
// Khai báo các Routes
app.use('/api/students', studentRoutes_1.default);
app.use('/api/classes', classRoutes_1.default);
app.use('/api/enrollments', enrollmentRoutes_1.default);
app.use('/api/attendance', attendanceRoutes_1.default);
app.use('/api/payments', paymentRoutes_1.default);
app.use('/api/auth', authRoutes_1.default);
app.use('/api/calendar', calendarRoutes_1.default);
app.use('/api/documents', documentRoutes_1.default);
app.use('/api/folders', folderRoutes_1.default);
app.use('/api/sessions', sessionRoutes_1.default);
app.use('/api/exams', examRoutes_1.default);
app.use('/api/assignments', assignmentRoutes_1.default);
app.use('/api/analytics', analyticsRoutes_1.default);
app.use('/api/ai', aiRoutes_1.default);
app.use('/api/reports', reportRoutes_1.default);
app.use('/api/upload', uploadRoutes_1.default);
app.use('/api/student', studentPortalRoutes_1.default);
// Đường dẫn gốc
app.get('/', (req, res) => {
    res.send('Chào mừng đến với máy chủ Quản lý dạy thêm!');
});
// API kiểm tra
app.use('/api/kiem-tra', (req, res) => {
    res.json({ message: 'Xin chào! Backend của hệ thống quản lý học tập đã hoạt động hoàn hảo!' });
});
// Chạy máy chủ
const PORT = process.env.PORT || 5000;
app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server đang chạy tại cổng ${PORT}`);
});
//# sourceMappingURL=index.js.map