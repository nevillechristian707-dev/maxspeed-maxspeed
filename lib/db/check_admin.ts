import { db, usersTable } from "./src/index.js";
import { eq } from "drizzle-orm";

async function checkAdmin() {
  const users = await db.select().from(usersTable).where(eq(usersTable.username, "admin"));
  console.log("Admin user in DB:", JSON.stringify(users, null, 2));
  process.exit(0);
}

checkAdmin().catch(err => {
  console.error(err);
  process.exit(1);
});
