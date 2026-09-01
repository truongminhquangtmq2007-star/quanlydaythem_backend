import { Request, Response } from 'express';
export interface AuthRequest extends Request {
    user?: {
        id: number;
        username: string;
        role: string;
        student_id?: number;
    };
}
export declare const searchGlobalStudents: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getStudents: (req: AuthRequest, res: Response) => Promise<void>;
export declare const createStudent: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getProfile360: (req: AuthRequest, res: Response) => Promise<void>;
export declare const updateStudent: (req: AuthRequest, res: Response) => Promise<void>;
export declare const deleteStudent: (req: AuthRequest, res: Response) => Promise<void>;
export declare const updateStudentGoals: (req: AuthRequest, res: Response) => Promise<void>;
export declare const resetStudentPassword: (req: AuthRequest, res: Response) => Promise<void>;
export declare const generateAIEvaluation: (req: AuthRequest, res: Response) => Promise<void>;
//# sourceMappingURL=studentController.d.ts.map