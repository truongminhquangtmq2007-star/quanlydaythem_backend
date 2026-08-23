const fs = require('fs');

let code = fs.readFileSync('src/controllers/studentPortalController.ts', 'utf8');

code = code.replace(
  'res.status(200).json({\n            profile,\n            stats: { avgScore, attendanceRate, examsCount },\n            weakTopics\n        });',
  `        // Lịch học sắp tới
        let upcomingSessions = [];
        try {
            const scheduleRes = await pool.query(
                \`SELECT s.id, s.session_date, s.start_time, c.class_name
                FROM sessions s
                JOIN classes c ON s.class_id = c.id
                JOIN enrollments e ON e.class_id = c.id
                WHERE e.student_id = $1 AND s.session_date >= CURRENT_DATE
                ORDER BY s.session_date ASC, s.start_time ASC
                LIMIT 5\`,
                [studentId]
            );
            upcomingSessions = scheduleRes.rows;
        } catch(e) { console.error(e); }

        // Đề thi/Bài tập
        let assignments = [];
        try {
            const docsRes = await pool.query(
                \`SELECT d.id, d.title, d.category AS type, c.class_name
                FROM documents d
                JOIN classes c ON d.class_id = c.id
                JOIN enrollments e ON e.class_id = c.id
                WHERE e.student_id = $1 AND d.class_id IS NOT NULL
                ORDER BY d.uploaded_at DESC
                LIMIT 5\`,
                [studentId]
            );
            assignments = docsRes.rows;
        } catch(e) { console.error(e); }

        res.status(200).json({
            profile,
            stats: { avgScore, attendanceRate, examsCount },
            weakTopics,
            upcomingSessions,
            assignments
        });`
);

fs.writeFileSync('src/controllers/studentPortalController.ts', code);
console.log('Fixed dashboard API');
