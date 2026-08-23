const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
async function run() {
  const students = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'students'");
  const sessions = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'sessions'");
  const documents = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'documents'");
  const enrollments = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'enrollments'");
  const class_members = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'class_members'");
  
  console.log('students:', students.rows.map(r=>r.column_name));
  console.log('sessions:', sessions.rows.map(r=>r.column_name));
  console.log('documents:', documents.rows.map(r=>r.column_name));
  console.log('enrollments:', enrollments.rows.map(r=>r.column_name));
  console.log('class_members:', class_members.rows.map(r=>r.column_name));
  pool.end();
}
run();

