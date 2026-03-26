import "dotenv/config";
import { getDb, penjualanTable, transaksiBank as transaksiBankTable } from "./lib/db/src/index.js";
import { eq, or, gte, lte, and, sql } from "drizzle-orm";

async function check() {
  const db = getDb();
  if (!db) return;

  const s = "2026-03-01";
  const e = "2026-03-31";

  const pRows = await db.select({
    id: penjualanTable.id,
    tanggal: penjualanTable.tanggal,
    total: penjualanTable.total,
    paymentMethod: penjualanTable.paymentMethod,
    statusCair: penjualanTable.statusCair,
    totalPaidAllTime: sql`coalesce(sum(${transaksiBankTable.nilai}), 0)`
  }).from(penjualanTable)
  .leftJoin(transaksiBankTable, eq(penjualanTable.id, transaksiBankTable.penjualanId))
  .where(or(
    and(gte(penjualanTable.tanggal, s), lte(penjualanTable.tanggal, e)),
    and(gte(penjualanTable.tanggalCair, s), lte(penjualanTable.tanggalCair, e)),
    and(
      lte(penjualanTable.tanggal, e),
      or(eq(penjualanTable.statusCair, "pending"), eq(penjualanTable.statusCair, "partial")),
      or(eq(penjualanTable.paymentMethod, "online_shop"), eq(penjualanTable.paymentMethod, "kredit"))
    )
  ))
  .groupBy(penjualanTable.id);

  console.log(`Total pRows: ${pRows.length}`);
  
  let osBelumCair = 0;
  let krBelumCair = 0;
  
  pRows.forEach((row: any) => {
    const val = parseFloat(String(row.total || "0"));
    const isCashOrBank = row.paymentMethod === 'cash' || row.paymentMethod === 'bank';
    
    if (!isCashOrBank && row.tanggal <= e) {
      const remaining = val - parseFloat(String(row.totalPaidAllTime || "0"));
      if (remaining > 0) {
        if (row.paymentMethod === 'online_shop') {
          osBelumCair += remaining;
        }
        if (row.paymentMethod === 'kredit') {
          krBelumCair += remaining;
        }
      }
    }
  });

  console.log(`OS Belum Cair: ${osBelumCair}`);
  console.log(`Kredit Belum Cair: ${krBelumCair}`);

  // Count how many Feb items are in pRows
  const febItems = pRows.filter((r: any) => r.tanggal < "2026-03-01");
  console.log(`\nFeb items in pRows: ${febItems.length}`);
  febItems.forEach((r: any) => {
    console.log(`  ID=${r.id} ${r.tanggal} ${r.paymentMethod} ${r.statusCair} total=${r.total} paid=${r.totalPaidAllTime}`);
  });

  process.exit(0);
}

check();
