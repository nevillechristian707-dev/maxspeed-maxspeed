import "dotenv/config";
import { getDb, penjualanTable, transaksiBank } from "./lib/db/src/index.js";
import { eq, or, lte, and, sql } from "drizzle-orm";

async function check() {
  const db = getDb();
  if (!db) return;

  const osRows = await db.select({
    id: penjualanTable.id,
    tanggal: penjualanTable.tanggal,
    total: penjualanTable.total,
    statusCair: penjualanTable.statusCair,
    totalPaid: sql`coalesce(sum(${transaksiBank.nilai}), 0)`
  }).from(penjualanTable)
  .leftJoin(transaksiBank, eq(penjualanTable.id, transaksiBank.penjualanId))
  .where(and(
    lte(penjualanTable.tanggal, "2026-03-31"),
    eq(penjualanTable.paymentMethod, "online_shop"),
    or(eq(penjualanTable.statusCair, "pending"), eq(penjualanTable.statusCair, "partial"))
  ))
  .groupBy(penjualanTable.id);

  let osPending = 0;
  osRows.forEach((r) => {
    const remaining = parseFloat(String(r.total || "0")) - parseFloat(String(r.totalPaid || "0"));
    if (remaining > 0) {
      osPending += remaining;
      console.log(`OS ID=${r.id} tanggal=${r.tanggal} total=${r.total} paid=${r.totalPaid} remaining=${remaining}`);
    }
  });
  console.log(`\nTotal OS Belum Cair (all-time): ${osPending}`);

  const krRows = await db.select({
    id: penjualanTable.id,
    tanggal: penjualanTable.tanggal,
    total: penjualanTable.total,
    statusCair: penjualanTable.statusCair,
    totalPaid: sql`coalesce(sum(${transaksiBank.nilai}), 0)`
  }).from(penjualanTable)
  .leftJoin(transaksiBank, eq(penjualanTable.id, transaksiBank.penjualanId))
  .where(and(
    lte(penjualanTable.tanggal, "2026-03-31"),
    eq(penjualanTable.paymentMethod, "kredit"),
    or(eq(penjualanTable.statusCair, "pending"), eq(penjualanTable.statusCair, "partial"))
  ))
  .groupBy(penjualanTable.id);

  let krPending = 0;
  krRows.forEach((r) => {
    const remaining = parseFloat(String(r.total || "0")) - parseFloat(String(r.totalPaid || "0"));
    if (remaining > 0) {
      krPending += remaining;
      console.log(`KR ID=${r.id} tanggal=${r.tanggal} total=${r.total} paid=${r.totalPaid} remaining=${remaining}`);
    }
  });
  console.log(`\nTotal Kredit Belum Cair (all-time): ${krPending}`);

  process.exit(0);
}

check();
