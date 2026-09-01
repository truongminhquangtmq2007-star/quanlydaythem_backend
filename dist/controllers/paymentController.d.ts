import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
export declare const getPayments: (req: AuthRequest, res: Response) => Promise<void>;
export declare const createPayment: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getBills: (req: AuthRequest, res: Response) => Promise<void>;
export declare const createBill: (req: AuthRequest, res: Response) => Promise<void>;
export declare const markBillAsPaid: (req: AuthRequest, res: Response) => Promise<void>;
export declare const deleteBill: (req: AuthRequest, res: Response) => Promise<void>;
export declare const addExamScores: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getBillInvoice: (req: AuthRequest, res: Response) => Promise<void>;
export declare const previewBill: (req: AuthRequest, res: Response) => Promise<void>;
//# sourceMappingURL=paymentController.d.ts.map