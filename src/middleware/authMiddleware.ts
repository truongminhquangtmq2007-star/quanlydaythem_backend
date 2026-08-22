import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// 1. Khai báo khuôn mẫu chính xác cho Thẻ từ (giống hệt lúc tạo ở authController)
export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: string;
    student_id?: number;
  };
}

export const verifyToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: "Không tìm thấy token xác thực, từ chối truy cập!" });
    return;
  }

  const token = authHeader.split(' ')[1]; 

  try {
    // 2. Ép kiểu (cast) dữ liệu sau khi giải mã về đúng khuôn mẫu AuthRequest['user']
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as AuthRequest['user'];
    
    // 3. Gắn thẻ đã giải mã vào Request để Controller phía sau sử dụng
    req.user = decoded; 
    
    next(); 
  } catch (error) {
    res.status(403).json({ message: "Token không hợp lệ hoặc đã hết hạn!" });
  }
};

// Ổ khóa chỉ dành cho Giám đốc
export const isAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  // Lấy thông tin user từ hàm verifyToken truyền sang
  const user = req.user;

  if (user && user.role === 'ADMIN') {
    next(); // Chức vụ đúng là ADMIN -> Mở cửa cho đi tiếp vào Controller
  } else {
    res.status(403).json({ message: "Từ chối truy cập! Chức năng này chỉ dành cho Ban Giám Đốc." });
  }
};