import "dotenv/config";
import { db, usersTable } from "./lib/db/src/index";
import { eq } from "drizzle-orm";

async function check() {
  const users = await db.select().from(usersTable).where(eq(usersTable.username, "admin"));
  console.log("Admin user:", JSON.stringify(users, null, 2));
  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
