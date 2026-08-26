import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

// 1. Định nghĩa các quy tắc cho dữ liệu Học sinh
const studentSchema = Joi.object({
  full_name: Joi.string().min(3).max(50).required().messages({
    'string.empty': 'Tên học sinh không được để trống.',
    'string.min': 'Tên học sinh phải có ít nhất 3 ký tự.',
    'any.required': 'Bắt buộc phải nhập tên học sinh.'
  }),
  phone_number: Joi.string().pattern(/^[0-9]{10}$/).required().messages({
    'string.pattern.base': 'Số điện thoại không hợp lệ (phải chứa đúng 10 chữ số).',
    'string.empty': 'Số điện thoại không được để trống.',
    'any.required': 'Bắt buộc phải nhập số điện thoại.'
  }),
  date_of_birth: Joi.date().iso().optional().allow(null, '').messages({
    'date.format': 'Ngày sinh phải đúng định dạng (VD: 2007-12-04).'
  }),
  school_name: Joi.string().optional().allow(null, ''),
  notes: Joi.string().optional().allow(null, ''),
  email: Joi.string().email().optional().allow(null, ''),
  password: Joi.string().min(6).optional().allow(null, '')
}).unknown(true);

// 2. Hàm Middleware để kiểm tra trước khi cho phép lưu vào Database
export const validateStudent = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = studentSchema.validate(req.body);
  
  if (error) {
    // Nếu có lỗi, chặn lại ngay và báo lỗi 400 (Bad Request)
    res.status(400).json({ message: error.details[0].message });
    return;
  }
  
  // Nếu dữ liệu sạch sẽ, cho phép đi tiếp đến Controller
  next();
};