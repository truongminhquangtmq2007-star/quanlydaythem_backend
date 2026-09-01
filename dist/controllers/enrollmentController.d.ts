import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
export declare const getEnrollments: (req: AuthRequest, res: Response) => Promise<void>;
export declare const enrollStudent: (req: AuthRequest, res: Response) => Promise<void>;
export declare const updateEnrollmentStatus: (req: AuthRequest, res: Response) => Promise<void>;
export declare const deleteEnrollment: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getStudentsInClass: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getClassesForStudent: (req: AuthRequest, res: Response) => Promise<void>;
//# sourceMappingURL=enrollmentController.d.ts.map