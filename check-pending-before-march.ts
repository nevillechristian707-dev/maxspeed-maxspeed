import "dotenv/config";
import { getDb, penjualanTable, transaksiBank } from "./lib/db/src/index.js";
import { lt, and, eq, sql } from "drizzle-orm";

async function check() {
  const db = getDb();
  if (!db) return;
  
  const mStart = "2026-03-01";
  
  const rows = await db.select({
    id: penjualanTable.id,
    total: penjualanTable.total,
    nilaiOnlineShop: penjualanTable.nilaiOnlineShop,
    totalPaidAllTime: sql<string>`(select coalesce(sum(nilai), 0) from transaksi_bank where penjualan_id = penjualan.id)`
  })
  .from(penjualanTable)
  .where(and(
    eq(penjualanTable.paymentMethod, "online_shop"),
    lt(penjualanTable.tanggal, mStart)
  ));
  
  let totalPending = 0;
  rows.forEach(r => {
    const val = parseFloat(r.nilaiOnlineShop || r.total || 0);
    const paid = parseFloat(r.totalPaidAllTime);
    if (val - paid > 0.1) {
      totalPending += (val - paid);
    }
  });
  
  console.log(`Pending OS before March: ${totalPending}`);
  process.exit(0);
}

check();
