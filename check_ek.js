const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'exam_keys'")
  .then(res => { console.log('exam_keys:', res.rows.map(r=>r.column_name)); pool.end(); })
  .catch(err => { console.error(err); pool.end(); });

