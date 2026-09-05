import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup stale records every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * In-memory rate limiter for AI Tutor:
 * - Window: 60 seconds
 * - Max: 15 requests per window
 * - Primary key: canonical student id or user id (defense-in-depth fallback to IP)
 */
export const aiTutorRateLimiter = (req: AuthRequest, res: Response, next: NextFunction): void => {
  let principalId: string;
  if (req.user?.id) {
    principalId = `user_${req.user.id}`;
  } else if (req.user?.student_id) {
    principalId = `student_${req.user.student_id}`;
  } else {
    // If identity cannot be resolved, strictly bucket by client IP (never synthesize a fake student ID bucket)
    principalId = `ip_${req.ip || req.socket?.remoteAddress || 'anonymous'}`;
  }

  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 15;

  const record = rateLimitStore.get(principalId);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(principalId, { count: 1, resetTime: now + windowMs });
    return next();
  }

  if (record.count >= maxRequests) {
    res.status(429).json({
      success: false,
      message: 'Bạn đang gửi câu hỏi tới Gia sư AI quá nhanh. Vui lòng đợi 1 phút trước khi hỏi câu tiếp theo.',
      error: {
        code: 'RATE_LIMITED',
        message: 'Bạn đang gửi câu hỏi tới Gia sư AI quá nhanh. Vui lòng đợi 1 phút trước khi hỏi câu tiếp theo.'
      }
    });
    return;
  }

  record.count += 1;
  next();
};

