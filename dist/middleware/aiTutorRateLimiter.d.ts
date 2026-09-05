import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';
/**
 * In-memory rate limiter for AI Tutor:
 * - Window: 60 seconds
 * - Max: 15 requests per window
 * - Primary key: canonical student id or user id (defense-in-depth fallback to IP)
 */
export declare const aiTutorRateLimiter: (req: AuthRequest, res: Response, next: NextFunction) => void;
//# sourceMappingURL=aiTutorRateLimiter.d.ts.map