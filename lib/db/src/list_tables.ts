import { db } from "./index.js";
import { sql } from "drizzle-orm";

async function check() {
  const tables = await db.execute(sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
  console.log("Tables in database:", tables.rows.map((r: any) => r.table_name));
  process.exit(0);
}
check();
