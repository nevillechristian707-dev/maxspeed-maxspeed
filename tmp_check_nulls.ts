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
    const res = await db.execute(sql`SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'penjualan'`);
    fs.writeFileSync('./tmp_output.txt', JSON.stringify(res.rows, null, 2));
  } catch (err) {
    fs.writeFileSync('./tmp_output.txt', err.message);
  }
  process.exit(0);
}
check();
