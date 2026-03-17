import { db } from "./index.js";
import { sql } from "drizzle-orm";

async function check() {
  const columns = await db.execute(sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'transaksi_bank'`);
  console.log("Columns in transaksi_bank:", columns.rows);
  process.exit(0);
}
check();
