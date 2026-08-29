const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Backup
    const questions = await client.query('SELECT * FROM questions WHERE quiz_id = 0');
    const examKeys = await client.query('SELECT * FROM exam_keys WHERE document_id = 0');
    
    fs.writeFileSync('phase2b_orphan_questions_backup.json', JSON.stringify(questions.rows, null, 2));
    fs.writeFileSync('phase2b_orphan_exam_keys_backup.json', JSON.stringify(examKeys.rows, null, 2));

    const backupReport = `# PHASE 2B DELETE BACKUP\n\nOrphan questions backed up: ${questions.rowCount}\nOrphan exam_keys backed up: ${examKeys.rowCount}\n`;
    fs.writeFileSync('C:/Users/roman/.gemini/antigravity/brain/6b0e0aab-1760-414d-9d06-7757b56b1d17/PHASE_2B_DELETE_BACKUP.md', backupReport);

    // 3. Delete
    const qCountBefore = await client.query('SELECT COUNT(*) as c FROM questions');
    const kCountBefore = await client.query('SELECT COUNT(*) as c FROM exam_keys');

    const delQ = await client.query('DELETE FROM questions WHERE quiz_id = 0');
    const delK = await client.query('DELETE FROM exam_keys WHERE document_id = 0');

    const qCountAfter = await client.query('SELECT COUNT(*) as c FROM questions');
    const kCountAfter = await client.query('SELECT COUNT(*) as c FROM exam_keys');

    console.log(`Questions: Before=${qCountBefore.rows[0].c}, Deleted=${delQ.rowCount}, After=${qCountAfter.rows[0].c}`);
    console.log(`Exam Keys: Before=${kCountBefore.rows[0].c}, Deleted=${delK.rowCount}, After=${kCountAfter.rows[0].c}`);

    if (delQ.rowCount === 28 && delK.rowCount === 1) {
      await client.query('COMMIT');
      console.log('COMMIT SUCCESS');
    } else {
      await client.query('ROLLBACK');
      console.log('ROLLBACK: Unexpected row count deleted.');
    }
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('ERROR:', e);
  } finally {
    client.release();
    process.exit(0);
  }
}
run();
