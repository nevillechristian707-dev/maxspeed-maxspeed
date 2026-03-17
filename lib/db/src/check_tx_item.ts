import { db, transaksiBank } from "./index.js";
import { eq } from "drizzle-orm";

async function check() {
  const item = await db.select().from(transaksiBank).where(eq(transaksiBank.penjualanId, 9));
  console.log("Transaksi Bank items for penjualanId 9:", JSON.stringify(item, null, 2));
  process.exit(0);
}
check();
