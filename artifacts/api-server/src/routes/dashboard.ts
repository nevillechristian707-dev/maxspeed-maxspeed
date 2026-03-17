import { Router, type IRouter } from "express";
import { getDb, penjualanTable, biayaTable } from "../../../../lib/db/src/index";
import { gte, lte, and, sql, desc } from "drizzle-orm";

const router: IRouter = Router();

function n(val: unknown): number {
  return parseFloat(String(val ?? "0")) || 0;
}

router.get("/summary", async (req, res) => {
    const db = getDb();
    if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    const { startDate, endDate } = req.query;
    const pConds: any[] = [];
    const bConds: any[] = [];
    if (startDate) {
      pConds.push(gte(penjualanTable.tanggal, String(startDate)));
      bConds.push(gte(biayaTable.tanggal, String(startDate)));
    }
    if (endDate) {
      pConds.push(lte(penjualanTable.tanggal, String(endDate)));
      bConds.push(lte(biayaTable.tanggal, String(endDate)));
    }

    const pRows = await db.select().from(penjualanTable)
      .where(pConds.length ? and(...pConds) : undefined);
    const bRows = await db.select().from(biayaTable)
      .where(bConds.length ? and(...bConds) : undefined);

    let totalPenjualan = 0, totalModal = 0, cashTotal = 0, bankTotal = 0, onlineShopTotal = 0, kreditTotal = 0;
    let kreditBelumCair = 0, onlineShopBelumCair = 0;
    let totalTransaksiSettled = 0;

    for (const row of pRows) {
      if (row.statusCair === "cair") {
        totalPenjualan += n(row.total);
        totalModal += n(row.hargaBeli) * n(row.qty);
        totalTransaksiSettled++;
      }
      
      if (row.paymentMethod === "cash") cashTotal += n(row.total);
      if (row.paymentMethod === "bank") bankTotal += n(row.total);
      if (row.paymentMethod === "online_shop") {
        onlineShopTotal += n(row.total);
        if (row.statusCair === "pending") onlineShopBelumCair += n(row.total);
      }
      if (row.paymentMethod === "kredit") {
        kreditTotal += n(row.total);
        if (row.statusCair === "pending") kreditBelumCair += n(row.total);
      }
    }

    const totalBiaya = bRows.reduce((s, r) => s + n(r.nilai), 0);
    const laba = totalPenjualan - totalModal - totalBiaya;
    const labaShared = laba * 0.1;

    return res.json({
      totalPenjualan, totalModal, totalBiaya, laba, labaShared,
      totalTransaksi: totalTransaksiSettled, cashTotal, bankTotal, onlineShopTotal, kreditTotal,
      kreditBelumCair, onlineShopBelumCair,
      biayaItems: bRows.map(r => ({
        id: r.id,
        tanggal: r.tanggal,
        keterangan: r.keterangan,
        nilai: n(r.nilai)
      }))
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/chart", async (req, res) => {
    const db = getDb();
    if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    const { period } = req.query;
    const isMonthly = period !== "daily";

    const rows = await db.select().from(penjualanTable).orderBy(penjualanTable.tanggal);
    const map = new Map<string, { penjualan: number; modal: number }>();

    for (const row of rows) {
      if (row.statusCair !== "cair") continue;
      
      const key = isMonthly
        ? row.tanggal.substring(0, 7)
        : row.tanggal.substring(0, 10);
      const existing = map.get(key) ?? { penjualan: 0, modal: 0 };
      existing.penjualan += n(row.total);
      existing.modal += n(row.hargaBeli) * n(row.qty);
      map.set(key, existing);
    }

    const sorted = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    return res.json({
      labels: sorted.map(([k]) => k),
      penjualan: sorted.map(([, v]) => v.penjualan),
      laba: sorted.map(([, v]) => v.penjualan - v.modal),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
