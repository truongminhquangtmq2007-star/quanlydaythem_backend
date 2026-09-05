import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
export declare const saveAnswerKey: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getDraftExam: (req: AuthRequest, res: Response) => Promise<void>;
export declare const saveDraftExam: (req: AuthRequest, res: Response) => Promise<void>;
export declare const submitExam: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getExamSubmissions: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getMySubmissions: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getSubmissionDetail: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getExamKey: (req: AuthRequest, res: Response) => Promise<void>;
export declare const generateAIExam: (req: AuthRequest, res: Response) => Promise<void>;
export declare const createExamFromText: (req: AuthRequest, res: Response) => Promise<void>;
export declare const parseExamFromFile: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getAllExams: (req: AuthRequest, res: Response) => Promise<void>;
export declare const publishExam: (req: AuthRequest, res: Response) => Promise<void>;
export declare const resolveCanonicalStudentId: (user: any) => Promise<number | null>;
export declare const resolveTutorMode: (doc: any, examKey: any, submission: any) => 'SOCRATIC' | 'EXPLANATORY';
export declare const askAITutor: (req: AuthRequest, res: Response) => Promise<void>;
//# sourceMappingURL=examController.d.ts.map