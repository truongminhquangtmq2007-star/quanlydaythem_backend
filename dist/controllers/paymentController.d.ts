import { Request, Response } from 'express';
interface AuthRequest extends Request {
    user?: any;
}
export declare const getPayments: (req: AuthRequest, res: Response) => Promise<void>;
export declare const createPayment: (req: Request, res: Response) => Promise<void>;
export declare const getBills: (req: any, res: any) => Promise<void>;
export declare const createBill: (req: any, res: any) => Promise<void>;
export declare const markBillAsPaid: (req: any, res: any) => Promise<void>;
export declare const addExamScores: (req: any, res: any) => Promise<any>;
export {};
//# sourceMappingURL=paymentController.d.ts.map