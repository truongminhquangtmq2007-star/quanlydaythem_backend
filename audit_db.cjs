const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function auditDB() {
    try {
        const tablesRes = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
        const tables = tablesRes.rows.map(r => r.table_name);
        
        console.log("=== DB TABLES ===");
        console.log(tables.join(", "));
        console.log("\n=== DB COLUMNS ===");
        
        for (const table of tables) {
            const colsRes = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position", [table]);
            console.log(`\nTable: ${table}`);
            colsRes.rows.forEach(col => {
                console.log(`  - ${col.column_name} (${col.data_type})`);
            });
        }
    } catch (error) {
        console.error("Error:", error);
    } finally {
        pool.end();
    }
}

auditDB();

