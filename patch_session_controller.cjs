const fs = require('fs');
let code = fs.readFileSync('src/controllers/sessionController.ts', 'utf8');

const importGoogle = `import { google } from 'googleapis';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'dummy_id';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'dummy_secret';
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://quanlydaythem-api.onrender.com/api/calendar/callback';
`;

if (!code.includes('import { google } from \'googleapis\'')) {
  code = code.replace("import pool from '../db';", "import pool from '../db';\n" + importGoogle);
}

const syncCalendarFn = `
export const syncCalendar = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // session id
    const teacherId = req.user?.id;

    if (!teacherId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const sessionRes = await pool.query('SELECT * FROM sessions WHERE id = $1', [id]);
    if (sessionRes.rows.length === 0) {
      res.status(404).json({ message: 'Không tìm thấy buổi học' });
      return;
    }
    const session = sessionRes.rows[0];

    const userResult = await pool.query('SELECT google_calendar_tokens FROM users WHERE id = $1', [teacherId]);
    const tokens = userResult.rows[0]?.google_calendar_tokens;
    if (!tokens) {
      res.status(400).json({ message: 'Chưa liên kết Google Calendar' });
      return;
    }

    const parsedTokens = typeof tokens === 'string' ? JSON.parse(tokens) : tokens;
    const userOAuth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI);
    userOAuth2Client.setCredentials(parsedTokens);
    const calendar = google.calendar({ version: 'v3', auth: userOAuth2Client });

    // Get emails
    const emailsRes = await pool.query(
      \`SELECT s.email FROM students s
       JOIN class_members cm ON s.id = cm.student_id
       WHERE cm.class_id = $1 AND cm.status = 'ACTIVE' AND s.is_active = true AND s.email IS NOT NULL\`,
      [session.class_id]
    );
    const attendees = emailsRes.rows.map(r => ({ email: r.email }));

    if (session.google_event_id) {
      // Update existing event
      await calendar.events.patch({
        calendarId: 'primary',
        eventId: session.google_event_id,
        requestBody: {
          attendees: attendees
        }
      });
      res.status(200).json({ message: 'Đồng bộ lại lịch Google thành công' });
    } else {
      // Create new event
      const event = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: session.content || 'Lịch học',
          start: { dateTime: session.session_date + 'T' + (session.start_time || '18:00') + ':00+07:00', timeZone: 'Asia/Ho_Chi_Minh' },
          end: { dateTime: session.session_date + 'T' + (session.end_time || '19:30') + ':00+07:00', timeZone: 'Asia/Ho_Chi_Minh' },
          attendees: attendees.length > 0 ? attendees : undefined
        }
      });
      await pool.query('UPDATE sessions SET google_event_id = $1 WHERE id = $2', [event.data.id, session.id]);
      res.status(200).json({ message: 'Tạo mới và đồng bộ lịch Google thành công' });
    }
  } catch (error) {
    console.error("Lỗi đồng bộ lại Google Calendar:", error);
    res.status(500).json({ message: 'Lỗi khi đồng bộ Google Calendar' });
  }
};
`;

if (!code.includes('export const syncCalendar')) {
  code += syncCalendarFn;
}

fs.writeFileSync('src/controllers/sessionController.ts', code);
console.log("Patched sessionController for syncCalendar.");

