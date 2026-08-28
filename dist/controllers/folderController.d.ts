import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
export declare const createFolder: (req: AuthRequest, res: Response) => Promise<void>;
export declare const renameFolder: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getDriveContents: (req: AuthRequest, res: Response) => Promise<void>;
//# sourceMappingURL=folderController.d.ts.map