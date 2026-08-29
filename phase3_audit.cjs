const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const fs = require('fs');
  let md = '# PHASE 3 PRE-FLIGHT AUDIT\n\n';

  const tables = ['assignments', 'student_topic_performance', 'questions', 'documents', 'exam_keys', 'exam_submissions', 'quizzes', 'quiz_results'];
  
  for (let table of tables) {
    try {
        const countRes = await pool.query(`SELECT COUNT(*) as c FROM ${table}`);
        const colRes = await pool.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = '${table}' ORDER BY ordinal_position`);
        const conRes = await pool.query(`SELECT conname, pg_get_constraintdef(c.oid) as def FROM pg_constraint c WHERE conrelid = '${table}'::regclass`);
        
        md += `## Table: ${table}\n`;
        md += `- **Row Count**: ${countRes.rows[0].c}\n`;
        md += `- **Columns**: \n${colRes.rows.map(r => `  - \`${r.column_name}\` (${r.data_type}) - Nullable: ${r.is_nullable}`).join('\n')}\n`;
        md += `- **Constraints**: \n${conRes.rows.map(r => `  - \`${r.conname}\`: ${r.def}`).join('\n')}\n\n`;
    } catch (e) {
        md += `## Table: ${table}\n- ERROR: ${e.message}\n\n`;
    }
  }

  // Specific queries
  const qQuiz0 = await pool.query(`SELECT COUNT(*) as c FROM questions WHERE quiz_id = 0`);
  md += `## Zero Quiz_id check\n- \`questions.quiz_id = 0\` -> ${qQuiz0.rows[0].c} rows\n`;

  const qDoc0 = await pool.query(`SELECT COUNT(*) as c FROM exam_keys WHERE document_id = 0`);
  md += `## Zero Document_id check\n- \`exam_keys.document_id = 0\` -> ${qDoc0.rows[0].c} rows\n`;
  
  const qDuplicate = await pool.query(`SELECT student_id, topic_name, COUNT(*) FROM student_topic_performance GROUP BY student_id, topic_name HAVING COUNT(*) > 1`);
  md += `## Duplicate Topic Performance check\n- Count: ${qDuplicate.rowCount} rows\n`;

  const qInvalidAcc = await pool.query(`SELECT COUNT(*) as c FROM student_topic_performance WHERE accuracy_rate < 0 OR accuracy_rate > 100`);
  md += `## Invalid Accuracy Rate check\n- Count: ${qInvalidAcc.rows[0].c} rows\n`;

  fs.writeFileSync('C:/Users/roman/.gemini/antigravity/brain/6b0e0aab-1760-414d-9d06-7757b56b1d17/PHASE_3_PRE_FLIGHT_AUDIT.md', md);
  console.log('Pre-flight audit generated.');
  process.exit(0);
}
run();

