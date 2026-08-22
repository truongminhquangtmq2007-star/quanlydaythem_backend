import { Request, Response } from 'express';
import { google } from 'googleapis';
import pool from '../db';
import { AuthRequest } from '../middleware/authMiddleware';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'dummy_id';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'dummy_secret';
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/calendar/callback';

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  REDIRECT_URI
);

export const authGoogleCalendar = (req: AuthRequest, res: Response): void => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar.events'],
      prompt: 'consent',
      state: String(userId)
    });

    res.redirect(authUrl);
  } catch (error) {
    console.error('Error generating auth url:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const oauthCallback = async (req: Request, res: Response): Promise<void> => {
  const { code, state } = req.query;

  if (!code || !state) {
    res.status(400).send('Missing code or state');
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code as string);
    const userId = parseInt(state as string, 10);

    await pool.query(
      'UPDATE users SET google_calendar_tokens = $1 WHERE id = $2',
      [JSON.stringify(tokens), userId]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'https://quanlydaythem-frontend-dun.vercel.app';
    res.redirect(`${frontendUrl}/quan-ly-tien-do?sync=success`);
  } catch (error) {
    console.error('Error exchanging code:', error);
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
      res.status(400).json({ message: 'Chưa liên kết Google Calendar' });
      return;
    }

    // Convert string to JSON if it's stored as string
    const parsedTokens = typeof tokens === 'string' ? JSON.parse(tokens) : tokens;
    
    // Create a local client for this user to avoid race conditions overriding tokens globally
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
  } catch (error) {
    console.error('Lỗi đồng bộ event:', error);
    res.status(500).json({ message: 'Lỗi đồng bộ Google Calendar' });
  }
};
