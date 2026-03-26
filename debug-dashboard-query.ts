import "dotenv/config";
import { getDb, penjualanTable, transaksiBank } from "./lib/db/src/index.js";
import { or, and, gte, lte, sql, eq } from "drizzle-orm";

async function check() {
  const db = getDb();
  if (!db) return;
  
  const s = "2026-03-01";
  const e = "2026-03-31";
  
  const pRows = await db.select({
    id: penjualanTable.id,
    paymentMethod: penjualanTable.paymentMethod,
    total: penjualanTable.total,
    totalPaidInRange: sql<string>`coalesce(sum(case when ${transaksiBank.tanggalCair} >= ${s} and ${transaksiBank.tanggalCair} <= ${e} then ${transaksiBank.nilai} else 0 end), 0)`,
    totalPaidAllTime: sql<string>`coalesce(sum(${transaksiBank.nilai}), 0)`
  }).from(penjualanTable)
  .leftJoin(transaksiBank, eq(penjualanTable.id, transaksiBank.penjualanId))
  .where(or(
    and(gte(penjualanTable.tanggal, s), lte(penjualanTable.tanggal, e)),
    and(gte(penjualanTable.tanggalCair, s), lte(penjualanTable.tanggalCair, e))
  ))
  .groupBy(penjualanTable.id);
  
  console.log(`pRows length: ${pRows.length}`);
  
  let osTotal = 0;
  let osBelumCair = 0;
  
  pRows.forEach((row: any) => {
    const val = parseFloat(row.total || "0");
    const paidAll = parseFloat(row.totalPaidAllTime || "0");
    const paidIn = parseFloat(row.totalPaidInRange || "0");
    
    if (row.paymentMethod === 'online_shop') {
      osTotal += paidIn;
      if (val - paidAll > 0) {
        osBelumCair += (val - paidAll);
      }
    }
  });
  
  console.log(`Calculated OS Total: ${osTotal}`);
  console.log(`Calculated OS Belum Cair: ${osBelumCair}`);
  
  process.exit(0);
}

check();
