import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
export declare const authGoogleCalendar: (req: AuthRequest, res: Response) => void;
export declare const oauthCallback: (req: Request, res: Response) => Promise<void>;
export declare const syncEvent: (req: AuthRequest, res: Response) => Promise<void>;
//# sourceMappingURL=calendarController.d.ts.map