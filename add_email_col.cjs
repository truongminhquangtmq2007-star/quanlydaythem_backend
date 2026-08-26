const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    await pool.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS email VARCHAR(255);`);
    console.log("Migration added email column to students.");
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
