import { Request, Response } from 'express';
import { google } from 'googleapis';
import pool from '../db';
import { AuthRequest } from '../middleware/authMiddleware';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'dummy_id';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'dummy_secret';
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://quanlydaythem-api.onrender.com/api/calendar/callback';

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  REDIRECT_URI
);

export const authGoogleCalendar = (req: AuthRequest, res: Response): void => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Chưa xác thực người dùng' });
      return;
    }

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar.events'],
      prompt: 'consent',
      state: String(userId)
    });

    // Check if client expects JSON or direct redirect
    const expectsJson = req.query.json === 'true' || 
                        req.headers.accept?.includes('application/json') || 
                        req.xhr;

    if (expectsJson) {
      res.status(200).json({ url: authUrl });
    } else {
      res.redirect(authUrl);
    }
  } catch (error) {
    console.error('Lỗi tạo Google Auth URL:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi tạo liên kết Google Calendar' });
  }
};

export const getCalendarStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const userResult = await pool.query('SELECT google_calendar_tokens FROM users WHERE id = $1', [userId]);
    const tokens = userResult.rows[0]?.google_calendar_tokens;
    const isConnected = Boolean(tokens && (typeof tokens === 'object' ? Object.keys(tokens).length > 0 : String(tokens).length > 5));

    res.status(200).json({ connected: isConnected });
  } catch (error) {
    console.error('Lỗi kiểm tra trạng thái Google Calendar:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

export const oauthCallback = async (req: Request, res: Response): Promise<void> => {
  const { code, state } = req.query;

  if (!code || !state) {
    const frontendUrl = process.env.FRONTEND_URL || 'https://quanlydaythem-frontend-dun.vercel.app';
    res.redirect(`${frontendUrl}/quan-ly-tien-do?sync=error&message=missing_code_or_state`);
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code as string);
    const userId = parseInt(state as string, 10);

    if (isNaN(userId)) {
      throw new Error('Invalid user ID in OAuth state');
    }

    await pool.query(
      'UPDATE users SET google_calendar_tokens = $1 WHERE id = $2',
      [JSON.stringify(tokens), userId]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'https://quanlydaythem-frontend-dun.vercel.app';
    res.redirect(`${frontendUrl}/quan-ly-tien-do?sync=success`);
  } catch (error) {
    console.error('Error exchanging OAuth code:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'https://quanlydaythem-frontend-dun.vercel.app';
    res.redirect(`${frontendUrl}/quan-ly-tien-do?sync=error`);
  }
};

export const syncEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { summary, description, start_time, end_time } = req.body;

    const userResult = await pool.query('SELECT google_calendar_tokens FROM users WHERE id = $1', [userId]);
    const tokens = userResult.rows[0]?.google_calendar_tokens;

    if (!tokens) {
      res.status(400).json({ message: 'Tài khoản chưa liên kết Google Calendar. Vui lòng bấm "Tích hợp Google Calendar" trước.' });
      return;
    }

    const parsedTokens = typeof tokens === 'string' ? JSON.parse(tokens) : tokens;
    const userOAuth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      REDIRECT_URI
    );
    userOAuth2Client.setCredentials(parsedTokens);

    const calendar = google.calendar({ version: 'v3', auth: userOAuth2Client });
    const event = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: summary || 'Lịch dạy',
        description: description || '',
        start: { dateTime: start_time || new Date().toISOString(), timeZone: 'Asia/Ho_Chi_Minh' },
        end: { dateTime: end_time || new Date(Date.now() + 3600000).toISOString(), timeZone: 'Asia/Ho_Chi_Minh' }
      }
    });

    res.status(200).json({ message: 'Đồng bộ sự kiện thành công', eventId: event.data.id });
  } catch (error: any) {
    console.error('Lỗi đồng bộ event:', error);
    if (error?.message?.includes('invalid_grant') || error?.code === 401) {
      res.status(401).json({ message: 'Phiên Google Calendar đã hết hạn. Vui lòng kết nối lại tài khoản.' });
      return;
    }
    res.status(500).json({ message: error?.message || 'Lỗi đồng bộ Google Calendar' });
  }
};
