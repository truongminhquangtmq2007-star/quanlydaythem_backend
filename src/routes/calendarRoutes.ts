import { Router, Request, Response, NextFunction } from 'express';
import { authGoogleCalendar, oauthCallback, syncEvent } from '../controllers/calendarController';
import { verifyToken } from '../middleware/authMiddleware';
import jwt from 'jsonwebtoken';

const router = Router();

const verifyTokenFromQuery = (req: Request, res: Response, next: NextFunction) => {
  const token = req.query.token as string;
  if (!token) {
    res.status(401).json({ message: 'Không tìm thấy token trên URL' });
    return;
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    (req as any).user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ message: 'Token không hợp lệ' });
    return;
  }
};

router.get('/auth', verifyTokenFromQuery, authGoogleCalendar);
router.get('/callback', oauthCallback);
router.post('/sync-event', verifyToken, syncEvent);

export default router;

