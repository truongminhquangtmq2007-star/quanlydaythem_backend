import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
export declare const getSessions: (req: AuthRequest, res: Response) => Promise<void>;
export declare const upsertSession: (req: AuthRequest, res: Response) => Promise<void>;
export declare const publishSessions: (req: AuthRequest, res: Response) => Promise<void>;
export declare const deleteSession: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getPublishedSessions: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getEvaluations: (req: AuthRequest, res: Response) => Promise<void>;
export declare const saveEvaluation: (req: AuthRequest, res: Response) => Promise<void>;
export declare const markSessionsAsBilled: (req: any, res: any) => Promise<void>;
export declare const syncCalendar: (req: AuthRequest, res: Response) => Promise<void>;
//# sourceMappingURL=sessionController.d.ts.map