import { Router, type IRouter } from "express";
import { getDb, biayaTable } from "../../../../lib/db/src/index";
import { eq, gte, lte, and, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (req, res) => {
    const db = getDb();
    if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    const { startDate, endDate } = req.query;
    const conditions = [];
    if (startDate) conditions.push(gte(biayaTable.tanggal, String(startDate)));
    if (endDate) conditions.push(lte(biayaTable.tanggal, String(endDate)));
    const rows = await db.select().from(biayaTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(biayaTable.tanggal));
    return res.json(rows.map(r => ({ ...r, nilai: parseFloat(String(r.nilai)) })));
  } catch (err) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", async (req, res) => {
    const db = getDb();
    if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    const { tanggal, keterangan, nilai } = req.body;
    const inserted = await db.insert(biayaTable).values({
      tanggal, keterangan, nilai: String(nilai)
    }).returning();
    const r = inserted[0];
    return res.status(201).json({ ...r, nilai: parseFloat(String(r.nilai)) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/:id", async (req, res) => {
    const db = getDb();
    if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    await db.delete(biayaTable).where(eq(biayaTable.id, parseInt(req.params.id)));
    return res.json({ success: true, message: "Deleted" });
  } catch (err) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
