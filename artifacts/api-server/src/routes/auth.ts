import { Router, type IRouter } from "express";
import { getDb, usersTable } from "../../../../lib/db/src/index";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Bad Request", message: "Username and password required" });
    }
    const db = getDb();
    if (!db) {
      return res.status(500).json({ error: "Internal Server Error", message: "Database connection not initialized. Please check DATABASE_URL in Vercel settings." });
    }
    const users = await db.select().from(usersTable).where(eq(usersTable.username, username));
    const user = users[0];
    if (!user || user.password !== password) {
      return res.status(401).json({ error: "Unauthorized", message: "Invalid username or password" });
    }
    (req.session as any).userId = user.id;
    return res.json({
      success: true,
      user: { id: user.id, username: user.username, name: user.name, role: user.role },
      sessionId: (req as any).sessionID
    });

  } catch (err: any) {
    console.error("Login Error:", err);
    return res.status(500).json({ 
      error: "Internal Server Error", 
      message: "Login failed",
      detail: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined
    });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Session destruction error:", err);
    }
    res.clearCookie("maxspeed.sid", {
      path: "/",
      secure: true,
      httpOnly: true,
      sameSite: "none",
    });
    return res.json({ success: true, message: "Logged out" });
  });
});

router.get("/me", async (req, res) => {
  try {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized", message: "Not authenticated" });
    }
    const db = getDb();
    if (!db) {
      return res.status(500).json({ error: "Internal Server Error", message: "Database not ready." });
    }

    // Import rolesTable and sql manually
    const { rolesTable } = await import("../../../../lib/db/src/index");
    const { sql } = await import("drizzle-orm");

    const userWithPermissions = await db.select({
      id: usersTable.id,
      username: usersTable.username,
      name: usersTable.name,
      role: usersTable.role,
      permissions: rolesTable.permissions,
    })
    .from(usersTable)
    .leftJoin(rolesTable, sql`LOWER(${usersTable.role}) = LOWER(${rolesTable.name})`)
    .where(eq(usersTable.id, userId))
    .limit(1);


    const user = userWithPermissions[0];
    if (!user) {
      return res.status(401).json({ error: "Unauthorized", message: "User not found" });
    }
    
    return res.json(user);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error", message: "Failed to get user" });
  }
});


export default router;
