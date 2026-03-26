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
    tanggal: penjualanTable.tanggal,
    total: penjualanTable.total,
    paymentMethod: penjualanTable.paymentMethod,
    statusCair: penjualanTable.statusCair,
    tanggalCair: penjualanTable.tanggalCair,
    totalPaidAllTime: sql<string>`(select coalesce(sum(nilai), 0) from transaksi_bank where penjualan_id = penjualan.id)`
  }).from(penjualanTable)
  .where(or(
    and(gte(penjualanTable.tanggal, s), lte(penjualanTable.tanggal, e)),
    and(gte(penjualanTable.tanggalCair, s), lte(penjualanTable.tanggalCair, e))
  ));
  
  console.log(`pRows length: ${pRows.length}`);
  
  let onlineShopBelumCair = 0;
  let oItems: any[] = [];
  
  pRows.forEach((row: any) => {
    const val = parseFloat(row.total || "0");
    const isCashOrBank = row.paymentMethod === 'cash' || row.paymentMethod === 'bank';
    const totalPaidAllTime = parseFloat(row.totalPaidAllTime);
    
    if (!isCashOrBank && row.tanggal <= e) {
      const remaining = val - totalPaidAllTime;
      if (remaining > 0) {
        if (row.paymentMethod === 'online_shop') {
          onlineShopBelumCair += remaining;
          oItems.push({ id: row.id, tanggal: row.tanggal, total: val, paid: totalPaidAllTime, remaining });
        }
      }
    }
  });
  
  console.log(`Dashboard OS Belum Cair Calculation: ${onlineShopBelumCair}`);
  console.log(`Number of items contributing: ${oItems.length}`);
  
  if (oItems.length > 0) {
    console.log("\nTop 5 contributing items:");
    console.log(JSON.stringify(oItems.sort((a,b) => b.remaining - a.remaining).slice(0, 5), null, 2));
  }

  process.exit(0);
}

check();
