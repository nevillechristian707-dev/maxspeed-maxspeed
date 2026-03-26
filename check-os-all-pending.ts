import "dotenv/config";
import { getDb, penjualanTable, transaksiBank } from "./lib/db/src/index.js";
import { lte, and, eq, sql } from "drizzle-orm";

async function check() {
  const db = getDb();
  if (!db) return;
  
  const mEnd = "2026-03-31";
  
  // Pending all time up to March 31
  const rows = await db.select({
    id: penjualanTable.id,
    tanggal: penjualanTable.tanggal,
    total: penjualanTable.total,
    nilaiOnlineShop: penjualanTable.nilaiOnlineShop,
    statusCair: penjualanTable.statusCair,
    totalPaid: sql<string>`(select coalesce(sum(nilai), 0) from transaksi_bank where penjualan_id = penjualan.id)`
  })
  .from(penjualanTable)
  .where(and(
    eq(penjualanTable.paymentMethod, "online_shop"),
    lte(penjualanTable.tanggal, mEnd)
  ));
  
  const pending = rows.filter(r => {
    const totalAmount = parseFloat(r.nilaiOnlineShop || r.total || 0);
    const paid = parseFloat(r.totalPaid);
    return paid < (totalAmount - 0.1);
  });
  
  console.log(`Total Pending OS items up to March: ${pending.length}`);
  const sumRemaining = pending.reduce((s, r) => {
    const totalAmount = parseFloat(r.nilaiOnlineShop || r.total || 0);
    const paid = parseFloat(r.totalPaid);
    return s + (totalAmount - paid);
  }, 0);
  
  console.log(`Sum of remaining 'nilaiOnlineShop': ${sumRemaining}`);
  
  const sumRemainingTotalField = pending.reduce((s, r) => {
    const totalAmount = parseFloat(r.total || 0);
    const paid = parseFloat(r.totalPaid);
    return s + (totalAmount - paid);
  }, 0);
  console.log(`Sum of remaining 'total' field: ${sumRemainingTotalField}`);

  process.exit(0);
}

check();
