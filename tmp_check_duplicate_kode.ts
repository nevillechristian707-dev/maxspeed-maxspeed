import fs from 'fs';
import { getDb } from "./lib/db/src/index.ts";
import { sql } from "drizzle-orm";
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const db = getDb();
  if (!db) {
    process.exit(1);
  }
  try {
     const res = await db.execute(sql`SELECT kode_transaksi, COUNT(*) FROM penjualan GROUP BY kode_transaksi HAVING COUNT(*) > 1`);
     console.log("Duplicate kode_transaksi:", res.rows);
     fs.writeFileSync('./tmp_output.txt', JSON.stringify(res.rows, null, 2));
  } catch (err) {
    fs.writeFileSync('./tmp_output.txt', err.message);
  }
  process.exit(0);
}
check();
