import express from 'express';
import { getBills, createBill, markBillAsPaid, deleteBill, previewBill, addExamScores, getBillInvoice } from '../controllers/paymentController';
import { verifyToken, isTeacherOrAdmin } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/', verifyToken, isTeacherOrAdmin, getBills);
router.post('/create', verifyToken, isTeacherOrAdmin, createBill);
router.put('/:id/pay', verifyToken, isTeacherOrAdmin, markBillAsPaid);
router.delete('/:id', verifyToken, isTeacherOrAdmin, deleteBill);
router.delete('/bills/:id', verifyToken, isTeacherOrAdmin, deleteBill);
router.post('/add-exam-scores', verifyToken, isTeacherOrAdmin, addExamScores);

router.get('/preview', verifyToken, isTeacherOrAdmin, previewBill);
router.get('/bill/:id/invoice', verifyToken, isTeacherOrAdmin, getBillInvoice);
export default router;