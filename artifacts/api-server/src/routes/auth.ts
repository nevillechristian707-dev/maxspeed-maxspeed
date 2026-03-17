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
    console.error(err);
    return res.status(500).json({ 
      error: "Internal Server Error", 
      message: "Login failed",
      detail: err.message 
    });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
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
    const users = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    const user = users[0];
    if (!user) {
      return res.status(401).json({ error: "Unauthorized", message: "User not found" });
    }
    return res.json({ id: user.id, username: user.username, name: user.name, role: user.role });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error", message: "Failed to get user" });
  }
});

export default router;
