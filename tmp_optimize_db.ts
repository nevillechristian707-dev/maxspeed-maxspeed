import fs from 'fs';
import { getDb } from "./lib/db/src/index.ts";
import { sql } from "drizzle-orm";
import dotenv from 'dotenv';
dotenv.config();

async function optimize() {
  const db = getDb();
  if (!db) {
    process.exit(1);
  }
  try {
     const results: any = {};
     
     // 1. Add composite index if not exists
     console.log("Adding index...");
     await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_penjualan_tanggal_nomor ON penjualan (tanggal, nomor)`);
     results.index = "OK";

     // 2. Check sequences vs max ID
     console.log("Checking sequences...");
     const tables = ['penjualan', 'transaksi_bank', 'master_barang'];
     results.sequences = [];
     for (const table of tables) {
       const maxRes = await db.execute(sql.raw(`SELECT MAX(id) as max_id FROM "${table}"`));
       const maxId = maxRes.rows[0].max_id || 0;
       const seqRes = await db.execute(sql.raw(`SELECT last_value FROM "${table}_id_seq"`));
       const seqVal = seqRes.rows[0].last_value;
       
       results.sequences.push({ table, maxId, seqVal });
       
       if (seqVal < maxId) {
         console.log(`Fixing sequence for ${table}...`);
         await db.execute(sql.raw(`SELECT setval('${table}_id_seq', ${maxId}, true)`));
       }
     }

     // 3. Analyze
     console.log("Analyzing tables...");
     await db.execute(sql`VACUUM ANALYZE penjualan`);
     await db.execute(sql`VACUUM ANALYZE transaksi_bank`);
     results.analyze = "OK";

     fs.writeFileSync('./tmp_output.txt', JSON.stringify(results, null, 2));
     console.log("Optimizations complete.");
  } catch (err: any) {
    fs.writeFileSync('./tmp_output.txt', err.message);
    console.error("Optimization failed:", err.message);
  }
  process.exit(0);
}
optimize();
