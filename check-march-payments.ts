import "dotenv/config";
import { getDb, transaksiBank } from "./lib/db/src/index.js";
import { and, gte, lte } from "drizzle-orm";

async function check() {
  const db = getDb();
  if (!db) return;
  
  const s = "2026-03-01";
  const e = "2026-03-31";
  
  const rows = await db.select().from(transaksiBank).where(and(
    gte(transaksiBank.tanggalCair, s),
    lte(transaksiBank.tanggalCair, e)
  ));
  
  console.log(`Total payments in March: ${rows.length}`);
  const sum = rows.reduce((acc, r) => acc + parseFloat(r.nilai || "0"), 0);
  console.log(`Sum of payments: ${sum}`);
  
  const os = rows.filter(r => r.sumber === "online_shop");
  console.log(`Online shop payments in March: ${os.length}`);
  console.log(`Sum of OS payments: ${os.reduce((acc, r) => acc + parseFloat(r.nilai || "0"), 0)}`);

  process.exit(0);
}

check();
