import { Router, Request, Response, NextFunction } from 'express';
import { authGoogleCalendar, getCalendarStatus, oauthCallback, syncEvent } from '../controllers/calendarController';
import { verifyToken, isTeacherOrAdmin } from '../middleware/authMiddleware';
import jwt from 'jsonwebtoken';

const router = Router();

const verifyTokenOrQuery = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
      (req as any).user = decoded;
      return next();
    } catch (err) {
      res.status(403).json({ message: 'Token không hợp lệ' });
      return;
    }
  }

  const token = req.query.token as string;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
      (req as any).user = decoded;
      return next();
    } catch (err) {
      res.status(403).json({ message: 'Token không hợp lệ' });
      return;
    }
  }

  res.status(401).json({ message: 'Chưa xác thực người dùng' });
};

// Support both /auth and /auth-url canonical endpoints
router.get('/auth', verifyTokenOrQuery, isTeacherOrAdmin, authGoogleCalendar);
router.get('/auth-url', verifyTokenOrQuery, isTeacherOrAdmin, authGoogleCalendar);
router.get('/status', verifyToken, isTeacherOrAdmin, getCalendarStatus);
router.get('/callback', oauthCallback);
router.post('/sync-event', verifyToken, isTeacherOrAdmin, syncEvent);

export default router;
