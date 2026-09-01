import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
export declare const explainError: (req: AuthRequest, res: Response) => Promise<void>;
export declare const generateRemark: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getRemark: (req: AuthRequest, res: Response) => Promise<void>;
export declare const saveRemark: (req: AuthRequest, res: Response) => Promise<void>;
//# sourceMappingURL=aiController.d.ts.map