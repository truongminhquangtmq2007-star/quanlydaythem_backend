"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTeacherOrAdmin = exports.isAdmin = exports.verifyToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ message: "Không tìm thấy token xác thực, từ chối truy cập!" });
        return;
    }
    const token = authHeader.split(' ')[1];
    try {
        // 2. Ép kiểu (cast) dữ liệu sau khi giải mã về đúng khuôn mẫu AuthRequest['user']
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        // 3. Gắn thẻ đã giải mã vào Request để Controller phía sau sử dụng
        req.user = decoded;
        next();
    }
    catch (error) {
        res.status(403).json({ message: "Token không hợp lệ hoặc đã hết hạn!" });
    }
};
exports.verifyToken = verifyToken;
// Ổ khóa chỉ dành cho Giám đốc
const isAdmin = (req, res, next) => {
    // Lấy thông tin user từ hàm verifyToken truyền sang
    const user = req.user;
    if (user && user.role === 'ADMIN') {
        next(); // Chức vụ đúng là ADMIN -> Mở cửa cho đi tiếp vào Controller
    }
    else {
        res.status(403).json({ message: "Từ chối truy cập! Chức năng này chỉ dành cho Ban Giám Đốc." });
    }
};
exports.isAdmin = isAdmin;
const isTeacherOrAdmin = (req, res, next) => {
    const user = req.user;
    if (user && (user.role === 'ADMIN' || user.role === 'TEACHER')) {
        next();
    }
    else {
        res.status(403).json({ message: 'Từ chối truy cập! Chức năng này chỉ dành cho Giáo viên hoặc Admin.' });
    }
};
exports.isTeacherOrAdmin = isTeacherOrAdmin;
//# sourceMappingURL=authMiddleware.js.map