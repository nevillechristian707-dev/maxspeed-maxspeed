import { Router, type IRouter } from "express";
import { db, usersTable, rolesTable } from "../../../../lib/db/src/index";
import { eq, not } from "drizzle-orm";

const router: IRouter = Router();

// Middleware to check if user is admin (optional safety net)
const requireAdmin = async (req: any, res: any, next: any) => {
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  
  const user = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const userRole = user[0]?.role?.toLowerCase();
  if (!user.length || (userRole !== "admin" && userRole !== "superadmin")) {
    return res.status(403).json({ error: "Forbidden", message: "Admin access required" });
  }
  next();
};

router.get("/", requireAdmin, async (req, res) => {
  try {
    const users = await db.select({
      id: usersTable.id,
      username: usersTable.username,
      name: usersTable.name,
      role: usersTable.role,
      createdAt: usersTable.createdAt
    }).from(usersTable);
    return res.json(users);
  } catch (err: any) {
    return res.status(500).json({ error: "Server Error", message: err.message });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const { username, password, name, role } = req.body;
    
    // Validate role exists
    const roleExists = await db.select().from(rolesTable).where(eq(rolesTable.name, role)).limit(1);
    if (!roleExists.length) return res.status(400).json({ error: "Invalid role selected" });

    const [newUser] = await db.insert(usersTable).values({
      username, password, name, role: role || "user"
    }).returning();
    return res.json({ success: true, user: newUser });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to create user", message: err.message });
  }
});

router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const { username, password, name, role } = req.body;
    const id = parseInt(req.params.id);
    
    const currentUser = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!currentUser.length) return res.status(404).json({ error: "User not found" });

    // If role is changing, validate new role
    if (role && role !== currentUser[0].role) {
      const roleExists = await db.select().from(rolesTable).where(eq(rolesTable.name, role)).limit(1);
      if (!roleExists.length) return res.status(400).json({ error: "Invalid role selected" });

      // Safety check: Prevent changing own role if admin
      if (id === (req.session as any).userId && (currentUser[0].role.toLowerCase() === "admin" || currentUser[0].role.toLowerCase() === "superadmin")) {
        return res.status(400).json({ error: "Admins cannot demote themselves" });
      }
    }

    const updateData: any = { username, name, role };
    if (password) updateData.password = password;

    const [updatedUser] = await db.update(usersTable)
      .set(updateData)
      .where(eq(usersTable.id, id))
      .returning();
      
    return res.json({ success: true, user: updatedUser });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to update user", message: err.message });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if ((req.session as any).userId === id) {
      return res.status(400).json({ error: "Cannot delete yourself" });
    }
    await db.delete(usersTable).where(eq(usersTable.id, id));
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to delete user", message: err.message });
  }
});

export default router;
