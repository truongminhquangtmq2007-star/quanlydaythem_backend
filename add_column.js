const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/quanlydaythem',
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('onrender') ? { rejectUnauthorized: false } : false
});
pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS google_calendar_tokens JSONB;').then(() => {
  console.log("Added google_calendar_tokens column.");
  process.exit(0);
}).catch(console.error);

