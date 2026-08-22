import express from 'express';
import { getBills, createBill, markBillAsPaid, addExamScores } from '../controllers/paymentController';

const router = express.Router();

// Định nghĩa các đường dẫn kết nối với Controller
router.get('/', getBills);
router.post('/create', createBill);
router.put('/:id/pay', markBillAsPaid);
router.post('/add-exam-scores', addExamScores);

export default router;