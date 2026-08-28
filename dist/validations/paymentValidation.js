"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePayment = void 0;
const joi_1 = __importDefault(require("joi"));
// Định nghĩa quy tắc cho dữ liệu Học phí
const paymentSchema = joi_1.default.object({
    student_id: joi_1.default.number().integer().required().messages({
        'number.base': 'Mã học sinh phải là một số.',
        'any.required': 'Bắt buộc phải có mã học sinh.'
    }),
    class_id: joi_1.default.number().integer().required().messages({
        'number.base': 'Mã lớp học phải là một số.',
        'any.required': 'Bắt buộc phải có mã lớp học.'
    }),
    amount: joi_1.default.number().positive().required().messages({
        'number.positive': 'Số tiền học phí phải lớn hơn 0.',
        'any.required': 'Bắt buộc phải nhập số tiền.'
    }),
    payment_method: joi_1.default.string().valid('Chuyển khoản', 'Tiền mặt').optional().messages({
        'any.only': 'Phương thức thanh toán chỉ được phép là "Chuyển khoản" hoặc "Tiền mặt".'
    }),
    notes: joi_1.default.string().optional()
});
// Middleware kiểm tra dữ liệu
const validatePayment = (req, res, next) => {
    const { error } = paymentSchema.validate(req.body);
    if (error) {
        res.status(400).json({ message: error.details[0].message });
        return;
    }
    next();
};
exports.validatePayment = validatePayment;
//# sourceMappingURL=paymentValidation.js.map