import fs from 'fs';
import { getDb, penjualanTable } from "./lib/db/src/index.ts";
import { sql } from "drizzle-orm";
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const db = getDb();
  if (!db) {
    process.exit(1);
  }
  try {
     const res = await db.execute(sql`SELECT count(*) FROM penjualan`);
     console.log("Total rows in penjualan:", res.rows[0].count);
     fs.writeFileSync('./tmp_output.txt', res.rows[0].count);
  } catch (err) {
    fs.writeFileSync('./tmp_output.txt', err.message);
  }
  process.exit(0);
}
check();
