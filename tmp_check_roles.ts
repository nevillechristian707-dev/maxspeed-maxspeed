import fs from 'fs';
import { getDb, rolesTable } from "./lib/db/src/index.ts";
import { sql } from "drizzle-orm";
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const db = getDb();
  if (!db) {
    process.exit(1);
  }
  try {
     const rows = await db.select().from(rolesTable);
     console.log("Total roles:", rows.length);
     fs.writeFileSync('./tmp_output.txt', JSON.stringify(rows, null, 2));
  } catch (err: any) {
    fs.writeFileSync('./tmp_output.txt', err.message);
  }
  process.exit(0);
}
check();
