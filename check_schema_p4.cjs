const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const res = await pool.query(`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name IN ('students', 'documents', 'folders', 'enrollments')
      ORDER BY table_name, ordinal_position;
    `);
    console.table(res.rows);
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();

