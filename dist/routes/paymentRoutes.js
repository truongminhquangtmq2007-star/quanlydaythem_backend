"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const paymentController_1 = require("../controllers/paymentController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
router.get('/', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, paymentController_1.getBills);
router.post('/create', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, paymentController_1.createBill);
router.put('/:id/pay', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, paymentController_1.markBillAsPaid);
router.delete('/:id', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, paymentController_1.deleteBill);
router.delete('/bills/:id', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, paymentController_1.deleteBill);
router.post('/add-exam-scores', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, paymentController_1.addExamScores);
router.get('/preview', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, paymentController_1.previewBill);
router.get('/bill/:id/invoice', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, paymentController_1.getBillInvoice);
exports.default = router;
//# sourceMappingURL=paymentRoutes.js.map