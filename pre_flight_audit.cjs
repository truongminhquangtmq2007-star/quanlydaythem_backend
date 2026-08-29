const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runAudit() {
  let report = '# PHASE 2 BEFORE SNAPSHOT\n\n';
  const tables = ['assignments', 'student_topic_performance', 'questions', 'documents', 'quizzes', 'exam_keys', 'exam_submissions'];
  
  for (const table of tables) {
    report += `## Table: ${table}\n`;
    try {
      const res = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
      report += `- Row count: ${res.rows[0].count}\n`;
    } catch (e) {
      report += `- Row count: ERROR (${e.message})\n`;
    }
  }

  report += '\n## Mapping: questions.quiz_id\n';
  try {
    const totalQ = await pool.query('SELECT COUNT(*) as c FROM questions');
    const distinctQid = await pool.query('SELECT COUNT(DISTINCT quiz_id) as c FROM questions');
    const nullQid = await pool.query('SELECT COUNT(*) as c FROM questions WHERE quiz_id IS NULL');
    const orphanQuiz = await pool.query('SELECT COUNT(*) as c FROM questions q WHERE q.quiz_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM quizzes z WHERE z.id = q.quiz_id)');
    const matchQuiz = await pool.query('SELECT COUNT(*) as c FROM questions q WHERE q.quiz_id IS NOT NULL AND EXISTS (SELECT 1 FROM quizzes z WHERE z.id = q.quiz_id)');
    const orphanDoc = await pool.query('SELECT COUNT(*) as c FROM questions q WHERE q.quiz_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM documents d WHERE d.id = q.quiz_id)');
    const matchDoc = await pool.query('SELECT COUNT(*) as c FROM questions q WHERE q.quiz_id IS NOT NULL AND EXISTS (SELECT 1 FROM documents d WHERE d.id = q.quiz_id)');
    
    report += `- Total questions: ${totalQ.rows[0].c}\n`;
    report += `- Distinct quiz_id: ${distinctQid.rows[0].c}\n`;
    report += `- NULL quiz_id: ${nullQid.rows[0].c}\n`;
    report += `- Orphan against quizzes: ${orphanQuiz.rows[0].c}\n`;
    report += `- Matched against quizzes: ${matchQuiz.rows[0].c}\n`;
    report += `- Orphan against documents: ${orphanDoc.rows[0].c}\n`;
    report += `- Matched against documents: ${matchDoc.rows[0].c}\n`;
  } catch (e) {
    report += `ERROR mapping: ${e.message}\n`;
  }

  report += '\n## Mapping: assignments\n';
  try {
    const cols = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'assignments'`);
    report += `- Columns:\n`;
    cols.rows.forEach(r => {
      report += `  - ${r.column_name} (${r.data_type})\n`;
    });
  } catch (e) {}

  fs.writeFileSync('C:/Users/roman/.gemini/antigravity/brain/6b0e0aab-1760-414d-9d06-7757b56b1d17/PHASE_2_BEFORE_SNAPSHOT.md', report);
  console.log('Done');
  process.exit(0);
}

runAudit();
