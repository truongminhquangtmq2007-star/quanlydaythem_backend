import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
export declare const createAssignment: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getClassAssignments: (req: AuthRequest, res: Response) => Promise<void>;
export declare const deleteAssignment: (req: AuthRequest, res: Response) => Promise<void>;
//# sourceMappingURL=assignmentController.d.ts.map