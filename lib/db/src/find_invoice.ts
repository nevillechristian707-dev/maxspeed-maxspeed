import { db, penjualanTable } from "./index.js";
import { eq } from "drizzle-orm";

async function check() {
  const item = await db.select().from(penjualanTable).where(eq(penjualanTable.noFaktur, "fk876574675"));
  console.log("Penjualan item for fk876574675:", JSON.stringify(item, null, 2));
  process.exit(0);
}
check();
