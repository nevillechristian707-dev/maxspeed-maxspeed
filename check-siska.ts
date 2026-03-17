import "dotenv/config";
import { db, usersTable, rolesTable } from "./lib/db/src/index";
import { eq } from "drizzle-orm";

async function checkSiska() {
  const siska = await db.select().from(usersTable).where(eq(usersTable.username, "siska"));
  console.log("Siska user:", JSON.stringify(siska, null, 2));
  
  if (siska.length > 0) {
    const role = await db.select().from(rolesTable).where(eq(rolesTable.name, siska[0].role));
    console.log("Siska's role data:", JSON.stringify(role, null, 2));
  }
  
  process.exit(0);
}

checkSiska().catch(e => {
  console.error(e);
  process.exit(1);
});
