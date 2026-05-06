import { Router, type IRouter } from "express";
import { getDb, usersTable, rolesTable } from "../../../../lib/db/src/index";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// Middleware to check if user is admin
const requireAdmin = async (req: any, res: any, next: any) => {
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database not initialized" });

  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const user = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const userRole = (user[0]?.role || "").toLowerCase();
  if (!user.length || (!userRole.includes("admin") && !userRole.includes("superadmin"))) {
    return res.status(403).json({ error: "Forbidden", message: "Admin access required" });
  }
  next();
};

router.get("/", requireAdmin, async (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    const roles = await db.select().from(rolesTable);
    return res.json(roles);
  } catch (err: any) {
    return res.status(500).json({ error: "Server Error", message: err.message });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    const { name, permissions } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Role name is required" });
    }

    // Prevent creating duplicate roles
    const existing = await db.select().from(rolesTable).where(eq(rolesTable.name, name));
    if (existing.length) return res.status(400).json({ error: "Role already exists" });

    const [newRole] = await db.insert(rolesTable).values({
      name, permissions: permissions || {}
    }).returning();

    return res.json({ success: true, role: newRole });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to create role", message: err.message });
  }
});

router.put("/:id", requireAdmin, async (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    const id = parseInt(req.params.id);
    const { name, permissions } = req.body;

    // Get old role name to sync users
    const oldRole = await db.select().from(rolesTable).where(eq(rolesTable.id, id)).limit(1);
    if (!oldRole.length) return res.status(404).json({ error: "Role not found" });

    const [updatedRole] = await db.update(rolesTable)
      .set({ name, permissions })
      .where(eq(rolesTable.id, id))
      .returning();

    // SYNC: if a role name changes, update all users using this role.
    if (name !== oldRole[0].name) {
      await db.update(usersTable)
        .set({ role: name })
        .where(eq(usersTable.role, oldRole[0].name));
    }

    return res.json({ success: true, role: updatedRole });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to update role", message: err.message });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    const id = parseInt(req.params.id);
    const role = await db.select().from(rolesTable).where(eq(rolesTable.id, id)).limit(1);
    if (!role.length) return res.status(404).json({ error: "Role not found" });

    const roleName = role[0].name.toLowerCase();
    if (roleName === "admin" || roleName === "superadmin") {
      return res.status(400).json({ error: "Cannot delete Admin role" });
    }

    // Check if any users are assigned to this role
    const usersWithRole = await db.select().from(usersTable).where(eq(usersTable.role, role[0].name)).limit(1);
    if (usersWithRole.length) {
      return res.status(400).json({ error: "Cannot delete role while users are assigned to it. Please reassign or delete the users first." });
    }

    await db.delete(rolesTable).where(eq(rolesTable.id, id));
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to delete role", message: err.message });
  }
});

export default router;
