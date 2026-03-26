import "dotenv/config";
import { getDb, penjualanTable } from "./lib/db/src/index.js";
import { gte, lte, and, eq } from "drizzle-orm";

async function check() {
  const db = getDb();
  if (!db) {
    console.error("No DB");
    return;
  }
  
  const mStart = "2026-03-01";
  const mEnd = "2026-03-31";
  
  const rows = await db.select()
    .from(penjualanTable)
    .where(and(
      eq(penjualanTable.paymentMethod, "online_shop"),
      gte(penjualanTable.tanggal, mStart),
      lte(penjualanTable.tanggal, mEnd)
    ));
    
  console.log(`Total OS items in March: ${rows.length}`);
  const totalAmount = rows.reduce((s, r) => s + parseFloat(r.total || 0), 0);
  const totalNilaiOS = rows.reduce((s, r) => s + parseFloat(r.nilaiOnlineShop || 0), 0);
  
  console.log(`Sum of 'total': ${totalAmount}`);
  console.log(`Sum of 'nilaiOnlineShop': ${totalNilaiOS}`);
  
  const pending = rows.filter(r => r.statusCair === "pending" || r.statusCair === "partial");
  console.log(`Pending/Partial items: ${pending.length}`);
  const sumPendingNilaiOS = pending.reduce((s, r) => s + parseFloat(r.nilaiOnlineShop || 0), 0);
  console.log(`Sum of pending 'nilaiOnlineShop': ${sumPendingNilaiOS}`);
  
  console.log("\nSample rows (first 5):");
  console.log(JSON.stringify(rows.slice(0, 5), null, 2));
  
  process.exit(0);
}

check();
