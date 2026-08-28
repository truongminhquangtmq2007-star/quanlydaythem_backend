"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncEvent = exports.oauthCallback = exports.authGoogleCalendar = void 0;
const googleapis_1 = require("googleapis");
const db_1 = __importDefault(require("../db"));
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'dummy_id';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'dummy_secret';
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://quanlydaythem-api.onrender.com/api/calendar/callback';
const oauth2Client = new googleapis_1.google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI);
const authGoogleCalendar = (req, res) => {
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
    }
    catch (error) {
        console.error('Error generating auth url:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.authGoogleCalendar = authGoogleCalendar;
const oauthCallback = async (req, res) => {
    const { code, state } = req.query;
    if (!code || !state) {
        res.status(400).send('Missing code or state');
        return;
    }
    try {
        const { tokens } = await oauth2Client.getToken(code);
        const userId = parseInt(state, 10);
        await db_1.default.query('UPDATE users SET google_calendar_tokens = $1 WHERE id = $2', [JSON.stringify(tokens), userId]);
        const frontendUrl = process.env.FRONTEND_URL || 'https://quanlydaythem-frontend-dun.vercel.app';
        res.redirect(`${frontendUrl}/quan-ly-tien-do?sync=success`);
    }
    catch (error) {
        console.error('Error exchanging code:', error);
        const frontendUrl = process.env.FRONTEND_URL || 'https://quanlydaythem-frontend-dun.vercel.app';
        res.redirect(`${frontendUrl}/quan-ly-tien-do?sync=error`);
    }
};
exports.oauthCallback = oauthCallback;
const syncEvent = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { summary, description, start_time, end_time } = req.body;
        const userResult = await db_1.default.query('SELECT google_calendar_tokens FROM users WHERE id = $1', [userId]);
        const tokens = userResult.rows[0]?.google_calendar_tokens;
        if (!tokens) {
            res.status(400).json({ message: 'Chưa liên kết Google Calendar' });
            return;
        }
        // Convert string to JSON if it's stored as string
        const parsedTokens = typeof tokens === 'string' ? JSON.parse(tokens) : tokens;
        // Create a local client for this user to avoid race conditions overriding tokens globally
        const userOAuth2Client = new googleapis_1.google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI);
        userOAuth2Client.setCredentials(parsedTokens);
        const calendar = googleapis_1.google.calendar({ version: 'v3', auth: userOAuth2Client });
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
    }
    catch (error) {
        console.error('Lỗi đồng bộ event:', error);
        res.status(500).json({ message: 'Lỗi đồng bộ Google Calendar' });
    }
};
exports.syncEvent = syncEvent;
//# sourceMappingURL=calendarController.js.map