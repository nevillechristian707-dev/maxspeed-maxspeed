import "dotenv/config";
import { getDb, usersTable, rolesTable } from "./lib/db/src/index.js";
import { sql } from "drizzle-orm";

async function checkUsers() {
  const db = getDb();
  if (!db) {
    console.error("Database connection failed. Please check DATABASE_URL.");
    return;
  }
  
  const users = await db.select().from(usersTable);
  console.log("=== USERS ===");
  users.forEach(u => {
    console.log(`ID: ${u.id}, Username: ${u.username}, Role: ${u.role}, Name: ${u.name}`);
  });

  const roles = await db.select().from(rolesTable);
  console.log("\n=== ROLES ===");
  roles.forEach(r => {
    console.log(`Role Name: ${r.name}`);
    console.log("Permissions:", JSON.stringify(r.permissions, null, 2));
  });

  // Check Siska specifically with the join logic used in /me
  console.log("\n=== SISKA (WITH JOIN) ===");
  const results = await db.select({
      username: usersTable.username,
      role: usersTable.role,
      role_name_in_roles: rolesTable.name,
      permissions: rolesTable.permissions,
    })
    .from(usersTable)
    .leftJoin(rolesTable, sql`LOWER(${usersTable.role}) = LOWER(${rolesTable.name})`)
    .where(sql`LOWER(${usersTable.username}) = 'siska'`);
  
  console.log(JSON.stringify(results, null, 2));
  
  process.exit(0);
}

checkUsers().catch(err => {
  console.error(err);
  process.exit(1);
});
