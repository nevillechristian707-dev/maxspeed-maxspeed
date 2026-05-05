import { getDb, biayaTable } from "../lib/db/src/index";
import { gte, lte, and } from "drizzle-orm";

async function check() {
  const db = getDb();
  if (!db) {
    console.log("No DB");
    return;
  }
  const all = await db.select().from(biayaTable);
  console.log("All Biaya:", JSON.stringify(all, null, 2));
}

check();
