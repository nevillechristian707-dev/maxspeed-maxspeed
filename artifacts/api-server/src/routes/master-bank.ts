import { Router, type IRouter } from "express";
import { getDb, masterBankTable } from "../../../../lib/db/src/index";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (_req, res) => {
  try {
    const rows = await db.select().from(masterBankTable).orderBy(masterBankTable.namaBank);
    return res.json(rows.map(r => ({ id: r.id, namaBank: r.namaBank, nomorRekening: r.nomorRekening, keterangan: r.keterangan })));
  } catch (err) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", async (req, res) => {
    const db = getDb();
    if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    const { namaBank, nomorRekening, keterangan } = req.body;
    const inserted = await db.insert(masterBankTable).values({ namaBank, nomorRekening, keterangan }).returning();
    const r = inserted[0];
    return res.status(201).json({ id: r.id, namaBank: r.namaBank, nomorRekening: r.nomorRekening, keterangan: r.keterangan });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/:id", async (req, res) => {
    const db = getDb();
    if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    await db.delete(masterBankTable).where(eq(masterBankTable.id, parseInt(req.params.id)));
    return res.json({ success: true, message: "Deleted" });
  } catch (err) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
