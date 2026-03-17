import { Router, type IRouter } from "express";
import { getDb, masterOnlineShopTable } from "../../../../lib/db/src/index";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (_req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(500).json({ error: "Database not initialized" });
    const rows = await db.select().from(masterOnlineShopTable).orderBy(masterOnlineShopTable.namaOnlineShop);
    return res.json(rows.map((r: any) => ({ id: r.id, namaOnlineShop: r.namaOnlineShop, keterangan: r.keterangan })));
  } catch (err) {
    console.error("GET Master Online Shop Error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", async (req, res) => {
    const db = getDb();
    if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    const { namaOnlineShop, keterangan } = req.body;
    const inserted = await db.insert(masterOnlineShopTable).values({ namaOnlineShop, keterangan }).returning();
    const r = inserted[0];
    return res.status(201).json({ id: r.id, namaOnlineShop: r.namaOnlineShop, keterangan: r.keterangan });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/:id", async (req, res) => {
    const db = getDb();
    if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    await db.delete(masterOnlineShopTable).where(eq(masterOnlineShopTable.id, parseInt(req.params.id)));
    return res.json({ success: true, message: "Deleted" });
  } catch (err) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
