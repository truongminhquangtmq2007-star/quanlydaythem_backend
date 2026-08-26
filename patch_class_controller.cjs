const fs = require('fs');
let code = fs.readFileSync('src/controllers/classController.ts', 'utf8');

const importGoogle = `import { google } from 'googleapis';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'dummy_id';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'dummy_secret';
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://quanlydaythem-api.onrender.com/api/calendar/callback';
`;

if (!code.includes('import { google } from \'googleapis\'')) {
  code = code.replace("import pool from '../db';", "import pool from '../db';\n" + importGoogle);
}

const createSessionOld = `    // 1. Tạo buổi học
    const sessionRes = await client.query(
      \`INSERT INTO sessions (class_id, session_date, start_time, end_time, content) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *\`,
      [id, session_date, start_time, end_time, content]
    );
    const session = sessionRes.rows[0];`;

const createSessionNew = `    // 1. Tạo buổi học
    const sessionRes = await client.query(
      \`INSERT INTO sessions (class_id, session_date, start_time, end_time, content) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *\`,
      [id, session_date, start_time, end_time, content]
    );
    const session = sessionRes.rows[0];

    // Google Calendar Sync
    try {
      const teacherId = (req as any).user?.id;
      if (teacherId) {
        const userResult = await client.query('SELECT google_calendar_tokens FROM users WHERE id = $1', [teacherId]);
        const tokens = userResult.rows[0]?.google_calendar_tokens;
        if (tokens) {
          const parsedTokens = typeof tokens === 'string' ? JSON.parse(tokens) : tokens;
          const userOAuth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI);
          userOAuth2Client.setCredentials(parsedTokens);
          const calendar = google.calendar({ version: 'v3', auth: userOAuth2Client });
          
          // Get students emails
          const emailsRes = await client.query(
            \`SELECT s.email FROM students s
             JOIN class_members cm ON s.id = cm.student_id
             WHERE cm.class_id = $1 AND cm.status = 'ACTIVE' AND s.is_active = true AND s.email IS NOT NULL\`,
            [id]
          );
          const attendees = emailsRes.rows.map(r => ({ email: r.email }));
          
          const event = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: {
              summary: content || 'Lịch học',
              start: { dateTime: session_date + 'T' + (start_time || '18:00') + ':00+07:00', timeZone: 'Asia/Ho_Chi_Minh' },
              end: { dateTime: session_date + 'T' + (end_time || '19:30') + ':00+07:00', timeZone: 'Asia/Ho_Chi_Minh' },
              attendees: attendees.length > 0 ? attendees : undefined
            }
          });
          
          await client.query('UPDATE sessions SET google_event_id = $1 WHERE id = $2', [event.data.id, session.id]);
        }
      }
    } catch (googleErr) {
      console.error("Lỗi đồng bộ Google Calendar khi tạo buổi học:", googleErr);
      // KHÔNG rollback session, chỉ log lỗi
    }`;

code = code.replace(createSessionOld, createSessionNew);
fs.writeFileSync('src/controllers/classController.ts', code);
console.log("Patched createSession in classController.");

