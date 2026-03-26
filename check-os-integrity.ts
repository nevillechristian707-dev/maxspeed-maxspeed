import "dotenv/config";
import { getDb, penjualanTable, transaksiBank } from "./lib/db/src/index.js";
import { eq, sql, and } from "drizzle-orm";

async function check() {
  const db = getDb();
  if (!db) return;
  
  const rows = await db.select({
    id: penjualanTable.id,
    tanggal: penjualanTable.tanggal,
    total: penjualanTable.total,
    nilaiOnlineShop: penjualanTable.nilaiOnlineShop,
    statusCair: penjualanTable.statusCair,
    tanggalCair: penjualanTable.tanggalCair,
    totalPaid: sql<string>`(select coalesce(sum(nilai), 0) from transaksi_bank where penjualan_id = penjualan.id)`
  })
  .from(penjualanTable)
  .where(eq(penjualanTable.paymentMethod, "online_shop"));
  
  const issues = rows.filter(r => {
    const totalAmount = parseFloat(r.nilaiOnlineShop || r.total || 0);
    const paid = parseFloat(r.totalPaid);
    const isCairSet = r.statusCair === "cair";
    const isActuallyPaid = paid >= (totalAmount - 0.1);
    
    return isCairSet !== isActuallyPaid;
  });
  
  console.log(`Total issues found: ${issues.length}`);
  
  const cairButNoPaid = issues.filter(r => r.statusCair === "cair" && parseFloat(r.totalPaid) === 0);
  console.log(`Cair in penjualan, but 0 in transaksi_bank: ${cairButNoPaid.length}`);
  
  const paidButNoCair = issues.filter(r => r.statusCair !== "cair" && parseFloat(r.totalPaid) > 0);
  console.log(`Has payments, but status is not 'cair': ${paidButNoCair.length}`);

  if (issues.length > 0) {
    console.log("\nSample problematic rows (first 5):");
    console.log(JSON.stringify(issues.slice(0, 5), null, 2));
  }
  
  process.exit(0);
}

check();
