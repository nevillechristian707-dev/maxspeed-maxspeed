import "dotenv/config";
import { getDb } from "./lib/db/src/index.js";
import { sql } from "drizzle-orm";

async function run() {
  const db = getDb();
  if (!db) { console.error("No DB"); process.exit(1); }
  
  console.log("Adding kode_pencairan column...");
  await db.execute(sql`ALTER TABLE transaksi_bank ADD COLUMN IF NOT EXISTS kode_pencairan VARCHAR(50)`);
  console.log("Column added!");
  
  console.log("Creating index...");
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_transaksi_bank_kode_pencairan ON transaksi_bank(kode_pencairan)`);
  console.log("Index created!");

  // Auto-generate kode_pencairan for existing records that don't have one
  // Group by tanggal_cair to assign batch codes
  const existing = await db.execute(sql`
    SELECT DISTINCT tanggal_cair FROM transaksi_bank 
    WHERE kode_pencairan IS NULL
    ORDER BY tanggal_cair
  `);
  
  if (existing.rows && existing.rows.length > 0) {
    console.log(`Found ${existing.rows.length} dates with NULL kode_pencairan, generating...`);
    for (const row of existing.rows) {
      const tgl = row.tanggal_cair as string;
      const dateStr = tgl.replace(/-/g, "");
      // Count existing codes for that month
      const month = tgl.substring(0, 7).replace("-", "");
      const countResult = await db.execute(sql`
        SELECT COUNT(DISTINCT kode_pencairan) as cnt 
        FROM transaksi_bank 
        WHERE kode_pencairan LIKE ${"PC-" + month + "%"}
      `);
      const nextNum = Number(countResult.rows[0]?.cnt || 0) + 1;
      const kodePencairan = `PC-${month}-${String(nextNum).padStart(3, "0")}`;
      
      await db.execute(sql`
        UPDATE transaksi_bank 
        SET kode_pencairan = ${kodePencairan}
        WHERE tanggal_cair = ${tgl} AND kode_pencairan IS NULL
      `);
      console.log(`  ${tgl} -> ${kodePencairan}`);
    }
  }

  console.log("Migration complete!");
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
