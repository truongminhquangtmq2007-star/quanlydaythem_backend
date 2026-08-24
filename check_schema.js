const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const tables = ['folders', 'documents', 'exam_submissions', 'assignments', 'students', 'attendance', 'sessions', 'exam_keys', 'users', 'enrollments', 'classes'];
  
  for (const t of tables) {
    const r = await pool.query(
      "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position",
      [t]
    );
    console.log('=== TABLE: ' + t + ' ===');
    if (r.rows.length === 0) {
      console.log('  (TABLE DOES NOT EXIST)');
    } else {
      r.rows.forEach(row => console.log('  ' + row.column_name + ' | ' + row.data_type + ' | nullable=' + row.is_nullable));
    }
    console.log('');
  }

  // Constraints for exam_keys and documents
  for (const t of ['exam_keys', 'documents', 'folders']) {
    const r = await pool.query(
      "SELECT tc.constraint_name, tc.constraint_type, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name FROM information_schema.table_constraints AS tc LEFT JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name LEFT JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name WHERE tc.table_schema = 'public' AND tc.table_name = $1",
      [t]
    );
    console.log('=== CONSTRAINTS: ' + t + ' ===');
    r.rows.forEach(row => console.log('  ' + row.constraint_name + ' | ' + row.constraint_type + ' | col=' + row.column_name + ' -> ' + row.foreign_table_name + '.' + row.foreign_column_name));
    console.log('');
  }

  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
