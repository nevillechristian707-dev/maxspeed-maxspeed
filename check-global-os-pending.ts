import "dotenv/config";
import { getDb, penjualanTable, transaksiBank } from "./lib/db/src/index.js";
import { lte, and, eq, sql } from "drizzle-orm";

async function check() {
  const db = getDb();
  if (!db) return;
  
  const e = "2026-03-31";
  
  const rows = await db.select({
    id: penjualanTable.id,
    tanggal: penjualanTable.tanggal,
    total: penjualanTable.total,
    paymentMethod: penjualanTable.paymentMethod,
    totalPaidAllTime: sql<string>`(select coalesce(sum(nilai), 0) from transaksi_bank where penjualan_id = penjualan.id)`
  })
  .from(penjualanTable)
  .where(and(
    eq(penjualanTable.paymentMethod, "online_shop"),
    lte(penjualanTable.tanggal, e)
  ));
  
  let totalOS = 0;
  rows.forEach(r => {
    const val = parseFloat(r.total || "0");
    const paid = parseFloat(r.totalPaidAllTime);
    if (val - paid > 0.1) {
      totalOS += (val - paid);
    }
  });
  
  console.log(`Global OS Pending up to ${e}: ${totalOS}`);
  process.exit(0);
}

check();
