import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

console.log("DATABASE_URL:", process.env.DATABASE_URL ? "Defined" : "Undefined");
const client = new Client({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

client.connect()
  .then(() => {
    console.log("✅ Connected to DB");
    return client.query('SELECT id, username, password, role FROM users');
  })
  .then(res => {
    console.log("USERS:");
    console.table(res.rows);
    process.exit(0);
  })
  .catch(err => {
    console.error("❌ DB Error:", err);
    process.exit(1);
  });
