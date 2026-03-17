import { db, transaksiBank } from "./index.js";
async function check() {
  const items = await db.select().from(transaksiBank);
  console.log("Transaksi Bank Count:", items.length);
  console.log(items);
  process.exit(0);
}
check();
