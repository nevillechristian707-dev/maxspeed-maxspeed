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
     const start = Date.now();
     await db.execute(sql`SELECT 1`);
     const end = Date.now();
     console.log("Database latency (SELECT 1):", end - start, "ms");
     
     const start2 = Date.now();
     await db.execute(sql`SELECT max(nomor) FROM penjualan`);
     const end2 = Date.now();
     console.log("Max nomor latency:", end2 - start2, "ms");

     fs.writeFileSync('./tmp_output.txt', `Latency: ${end - start}ms, MaxNomor: ${end2 - start2}ms`);
  } catch (err) {
    fs.writeFileSync('./tmp_output.txt', err.message);
  }
  process.exit(0);
}
check();
