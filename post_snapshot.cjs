const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const qAssignments = await pool.query("SELECT COUNT(*) as c FROM assignments");
  const colAssignments = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'assignments' ORDER BY ordinal_position");
  
  const qPerformance = await pool.query("SELECT COUNT(*) as c FROM student_topic_performance");
  const conPerformance = await pool.query("SELECT conname, pg_get_constraintdef(c.oid) as def FROM pg_constraint c WHERE conrelid = 'student_topic_performance'::regclass");
  
  const colSubmissions = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'exam_submissions' AND column_name = 'is_performance_aggregated'");
  const qQuestions = await pool.query("SELECT COUNT(*) as c FROM questions WHERE quiz_id = 0");
  const qKeys = await pool.query("SELECT COUNT(*) as c FROM exam_keys WHERE document_id = 0");

  let report = `# PHASE 2C POST SNAPSHOT\n\n`;
  report += `## assignments\n- Count: ${qAssignments.rows[0].c}\n- Columns: ${colAssignments.rows.map(r => r.column_name).join(', ')}\n`;
  report += `## student_topic_performance\n- Count: ${qPerformance.rows[0].c}\n- Constraints: ${conPerformance.rows.map(r => r.def).join(' | ')}\n`;
  report += `## exam_submissions\n- Has is_performance_aggregated: ${colSubmissions.rowCount > 0}\n`;
  report += `## questions (quiz_id=0)\n- Count: ${qQuestions.rows[0].c}\n`;
  report += `## exam_keys (document_id=0)\n- Count: ${qKeys.rows[0].c}\n`;

  const fs = require('fs');
  fs.writeFileSync('C:/Users/roman/.gemini/antigravity/brain/6b0e0aab-1760-414d-9d06-7757b56b1d17/PHASE_2C_POST_SNAPSHOT.md', report);
  console.log('Done!');
  process.exit(0);
}
run();

