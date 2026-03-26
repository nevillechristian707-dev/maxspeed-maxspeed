import "dotenv/config";
import { getDb, penjualanTable, transaksiBank } from "./lib/db/src/index.js";
import { or, and, gte, lte, eq } from "drizzle-orm";

async function check() {
  const db = getDb();
  if (!db) return;
  
  const s = "2026-03-01";
  const e = "2026-03-31";
  
  const rows = await db.select({
    paymentMethod: penjualanTable.paymentMethod,
    total: penjualanTable.total
  }).from(penjualanTable)
  .where(or(
    and(gte(penjualanTable.tanggal, s), lte(penjualanTable.tanggal, e)),
    and(gte(penjualanTable.tanggalCair, s), lte(penjualanTable.tanggalCair, e))
  ));
  
  let totalRawOS = 0;
  rows.forEach(r => {
    if (r.paymentMethod === 'online_shop') {
      totalRawOS += parseFloat(r.total || "0");
    }
  });
  
  console.log(`Sum of 'total' for OS in pRows: ${totalRawOS}`);
  process.exit(0);
}

check();
