import { Router, type IRouter } from "express";
import { getDb, penjualanTable } from "../../../../lib/db/src/index";
import { gte, lte, and, desc } from "drizzle-orm";

const router: IRouter = Router();

function n(val: unknown): number {
  return parseFloat(String(val ?? "0")) || 0;
}

router.get("/", async (req, res) => {
    const db = getDb();
    if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    const { startDate, endDate } = req.query;
    const conds: any[] = [];
    if (startDate) conds.push(gte(penjualanTable.tanggal, String(startDate)));
    if (endDate) conds.push(lte(penjualanTable.tanggal, String(endDate)));

    const rows = await db.select().from(penjualanTable)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(penjualanTable.tanggal));

    const items = rows.map(row => ({
      id: row.id,
      tanggal: row.tanggal,
      kodeTransaksi: row.kodeTransaksi,
      kodeBarang: row.kodeBarang,
      namaBarang: row.namaBarang,
      brand: row.brand,
      qty: row.qty,
      harga: n(row.harga),
      total: n(row.total),
      hargaBeli: n(row.hargaBeli),
      totalModal: n(row.totalModal),
      paymentMethod: row.paymentMethod,
    }));

    const totalPenjualan = items.reduce((s, r) => s + r.total, 0);
    const totalModal = items.reduce((s, r) => s + r.totalModal, 0);
    const totalLaba = totalPenjualan - totalModal;

    return res.json({ items, totalPenjualan, totalModal, totalLaba });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
