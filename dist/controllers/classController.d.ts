import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
export declare const getClasses: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getClass: (req: AuthRequest, res: Response) => Promise<void>;
export declare const createClass: (req: AuthRequest, res: Response) => Promise<void>;
export declare const updateClass: (req: AuthRequest, res: Response) => Promise<void>;
export declare const deleteClass: (req: Request, res: Response) => Promise<void>;
export declare const assignTeacher: (req: Request, res: Response) => Promise<void>;
export declare const getClassMembers: (req: Request, res: Response) => Promise<void>;
export declare const getClassSessions: (req: Request, res: Response) => Promise<void>;
export declare const getSessionAttendance: (req: Request, res: Response) => Promise<void>;
export declare const addMember: (req: Request, res: Response) => Promise<void>;
export declare const createSession: (req: Request, res: Response) => Promise<void>;
export declare const updateAttendance: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=classController.d.ts.map