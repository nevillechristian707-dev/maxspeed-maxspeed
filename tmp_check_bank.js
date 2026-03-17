require('dotenv').config();
const { Pool } = require('pg');

async function checkBanks() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("pooler.supabase.com") ? { rejectUnauthorized: false } : undefined,
  });

  try {
    const res = await pool.query('SELECT * FROM master_bank');
    console.log('=== MASTER BANK DATA ===');
    console.log(`Total Rows: ${res.rows.length}`);
    console.table(res.rows);
  } catch (err) {
    console.error('Error querying master_bank:', err.message);
  } finally {
    await pool.end();
  }
}

checkBanks();
