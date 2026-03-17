import { Router, type IRouter } from "express";
import { getDb, penjualanTable } from "../../../../lib/db/src/index";
import { eq, or } from "drizzle-orm";

const router: IRouter = Router();

function toNumber(val: unknown): number {
  return parseFloat(String(val ?? "0")) || 0;
}

router.get("/", async (req, res) => {
    const db = getDb();
    if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    const rows = await db.select().from(penjualanTable)
      .where(
        or(
          eq(penjualanTable.paymentMethod, "online_shop"),
          eq(penjualanTable.paymentMethod, "kredit")
        )
      );
    return res.json(rows.map(row => ({
      id: row.id,
      tanggal: row.tanggal,
      kodeTransaksi: row.kodeTransaksi,
      namaBarang: row.namaBarang,
      paymentMethod: row.paymentMethod,
      namaOnlineShop: row.namaOnlineShop,
      namaCustomer: row.namaCustomer,
      nilai: row.paymentMethod === "online_shop" ? toNumber(row.nilaiOnlineShop) : toNumber(row.nilaiKredit),
      status: row.statusCair ?? "pending",
      tanggalCair: row.tanggalCair,
    })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/:id/mark-settled", async (req, res) => {
    const db = getDb();
    if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    const { tanggalCair } = req.body;
    const id = parseInt(req.params.id);
    const updated = await db.update(penjualanTable)
      .set({ statusCair: "cair", tanggalCair })
      .where(eq(penjualanTable.id, id))
      .returning();
    if (!updated.length) return res.status(404).json({ error: "Not found" });
    const row = updated[0];
    return res.json({
      id: row.id,
      tanggal: row.tanggal,
      kodeTransaksi: row.kodeTransaksi,
      namaBarang: row.namaBarang,
      paymentMethod: row.paymentMethod,
      namaOnlineShop: row.namaOnlineShop,
      namaCustomer: row.namaCustomer,
      nilai: row.paymentMethod === "online_shop" ? toNumber(row.nilaiOnlineShop) : toNumber(row.nilaiKredit),
      status: row.statusCair ?? "pending",
      tanggalCair: row.tanggalCair,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
