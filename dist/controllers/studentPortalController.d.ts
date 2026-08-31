import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
export declare const getDashboard: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getSchedule: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getDocuments: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getStudentExams: (req: AuthRequest, res: Response) => Promise<void>;
export declare const updateEmail: (req: AuthRequest, res: Response) => Promise<void>;
//# sourceMappingURL=studentPortalController.d.ts.map