import { Router, type IRouter } from "express";
import { getDb, customerTable } from "../../../../lib/db/src/index";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (_req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(500).json({ error: "Database not initialized" });
    const rows = await db.select().from(customerTable).orderBy(customerTable.namaCustomer);
    return res.json(rows.map((r: any) => ({ id: r.id, namaCustomer: r.namaCustomer, keterangan: r.keterangan })));
  } catch (err) {
    console.error("GET Customer Error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", async (req, res) => {
    const db = getDb();
    if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    const { namaCustomer, keterangan } = req.body;
    const inserted = await db.insert(customerTable).values({ namaCustomer, keterangan }).returning();
    const r = inserted[0];
    return res.status(201).json({ id: r.id, namaCustomer: r.namaCustomer, keterangan: r.keterangan });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/:id", async (req, res) => {
    const db = getDb();
    if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    await db.delete(customerTable).where(eq(customerTable.id, parseInt(req.params.id)));
    return res.json({ success: true, message: "Deleted" });
  } catch (err) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
