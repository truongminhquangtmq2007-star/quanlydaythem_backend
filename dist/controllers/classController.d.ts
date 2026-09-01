import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
export declare const getClasses: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getClass: (req: AuthRequest, res: Response) => Promise<void>;
export declare const createClass: (req: AuthRequest, res: Response) => Promise<void>;
export declare const updateClass: (req: AuthRequest, res: Response) => Promise<void>;
export declare const deleteClass: (req: AuthRequest, res: Response) => Promise<void>;
export declare const assignTeacher: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getClassMembers: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getClassSessions: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getSessionAttendance: (req: AuthRequest, res: Response) => Promise<void>;
export declare const addMember: (req: AuthRequest, res: Response) => Promise<void>;
export declare const removeMember: (req: AuthRequest, res: Response) => Promise<void>;
export declare const createSession: (req: AuthRequest, res: Response) => Promise<void>;
export declare const updateAttendance: (req: AuthRequest, res: Response) => Promise<void>;
//# sourceMappingURL=classController.d.ts.map