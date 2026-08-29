const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
pool.query("SELECT conname, pg_get_constraintdef(c.oid) as def FROM pg_constraint c WHERE conrelid = 'documents'::regclass").then(res => console.log(res.rows)).finally(() => process.exit(0));
