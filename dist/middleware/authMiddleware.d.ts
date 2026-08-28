import { Request, Response, NextFunction } from 'express';
export interface AuthRequest extends Request {
    user?: {
        id: number;
        username: string;
        role: string;
        student_id?: number;
    };
}
export declare const verifyToken: (req: AuthRequest, res: Response, next: NextFunction) => void;
export declare const isAdmin: (req: AuthRequest, res: Response, next: NextFunction) => void;
export declare const isTeacherOrAdmin: (req: AuthRequest, res: Response, next: NextFunction) => void;
//# sourceMappingURL=authMiddleware.d.ts.map