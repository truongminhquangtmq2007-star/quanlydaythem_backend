const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS google_event_id VARCHAR(255);`);
    console.log("Migration added google_event_id column to sessions.");
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
