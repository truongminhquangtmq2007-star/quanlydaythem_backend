import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

// Định nghĩa quy tắc cho dữ liệu Học phí
const paymentSchema = Joi.object({
  student_id: Joi.number().integer().required().messages({
    'number.base': 'Mã học sinh phải là một số.',
    'any.required': 'Bắt buộc phải có mã học sinh.'
  }),
  class_id: Joi.number().integer().required().messages({
    'number.base': 'Mã lớp học phải là một số.',
    'any.required': 'Bắt buộc phải có mã lớp học.'
  }),
  amount: Joi.number().positive().required().messages({
    'number.positive': 'Số tiền học phí phải lớn hơn 0.',
    'any.required': 'Bắt buộc phải nhập số tiền.'
  }),
  payment_method: Joi.string().valid('Chuyển khoản', 'Tiền mặt').optional().messages({
    'any.only': 'Phương thức thanh toán chỉ được phép là "Chuyển khoản" hoặc "Tiền mặt".'
  }),
  notes: Joi.string().optional()
});

// Middleware kiểm tra dữ liệu
export const validatePayment = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = paymentSchema.validate(req.body);
  
  if (error) {
    res.status(400).json({ message: error.details[0].message });
    return;
  }
  
  next();
};