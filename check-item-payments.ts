import "dotenv/config";
import { getDb, transaksiBank } from "./lib/db/src/index.js";
import { eq } from "drizzle-orm";

async function check() {
  const db = getDb();
  if (!db) return;
  
  const id = 35; // Item from my first script
  const rows = await db.select().from(transaksiBank).where(eq(transaksiBank.penjualanId, id));
  
  console.log(`Payments for item ${id}:`);
  console.log(JSON.stringify(rows, null, 2));
  
  process.exit(0);
}

check();
