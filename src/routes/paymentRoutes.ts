import express from 'express';
import { getBills, createBill, markBillAsPaid, previewBill, addExamScores, getBillInvoice } from '../controllers/paymentController';

const router = express.Router();

// Định nghĩa các đường dẫn kết nối với Controller
router.get('/', getBills);
router.post('/create', createBill);
router.put('/:id/pay', markBillAsPaid);
router.post('/add-exam-scores', addExamScores);

router.get('/preview', previewBill);
router.get('/bill/:id/invoice', getBillInvoice);
export default router;