import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
export declare const createFolder: (req: AuthRequest, res: Response) => Promise<void>;
export declare const updateFolder: (req: AuthRequest, res: Response) => Promise<void>;
export declare const deleteFolder: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getFolderContents: (req: AuthRequest, res: Response) => Promise<void>;
export declare const addDocument: (req: AuthRequest, res: Response) => Promise<void>;
export declare const updateDocument: (req: AuthRequest, res: Response) => Promise<void>;
export declare const deleteDocument: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getAllDocuments: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getDrive: (req: AuthRequest, res: Response) => Promise<void>;
//# sourceMappingURL=documentController.d.ts.map