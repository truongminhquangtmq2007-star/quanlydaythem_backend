import { Request, Response } from 'express';
interface AuthRequest extends Request {
    user?: {
        id: number;
        [key: string]: unknown;
    };
}
export declare const login: (req: Request, res: Response) => Promise<void>;
export declare const register: (req: Request, res: Response) => Promise<void>;
export declare const studentLogin: (req: Request, res: Response) => Promise<void>;
export declare const getTeachers: (req: Request, res: Response) => Promise<void>;
export declare const createTeacher: (req: Request, res: Response) => Promise<void>;
export declare const resetTeacherPassword: (req: Request, res: Response) => Promise<void>;
export declare const getMe: (req: AuthRequest, res: Response) => Promise<void>;
export declare const updateProfile: (req: AuthRequest, res: Response) => Promise<void>;
export {};
//# sourceMappingURL=authController.d.ts.map