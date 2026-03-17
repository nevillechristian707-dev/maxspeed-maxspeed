import { Router, type IRouter } from "express";
import { getDb, penjualanTable, biayaTable } from "../../../../lib/db/src/index";
import { gte, lte, and, sql } from "drizzle-orm";

const router: IRouter = Router();

function n(val: unknown): number {
  return parseFloat(String(val ?? "0")) || 0;
}

router.get("/profit", async (req, res) => {
    const db = getDb();
    if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    const { startDate, endDate } = req.query;
    const sd = String(startDate ?? "2000-01-01");
    const ed = String(endDate ?? "2099-12-31");

    const pRows = await db.select().from(penjualanTable)
      .where(and(gte(penjualanTable.tanggal, sd), lte(penjualanTable.tanggal, ed)));
    const bRows = await db.select().from(biayaTable)
      .where(and(gte(biayaTable.tanggal, sd), lte(biayaTable.tanggal, ed)));

    const totalPenjualan = pRows.reduce((s, r) => s + (r.statusCair === "cair" ? n(r.total) : 0), 0);
    const totalModal = pRows.reduce((s, r) => s + (r.statusCair === "cair" ? n(r.hargaBeli) * n(r.qty) : 0), 0);
    const totalBiaya = bRows.reduce((s, r) => s + n(r.nilai), 0);
    const laba = totalPenjualan - totalModal - totalBiaya;
    const labaShared = laba * 0.1;

    return res.json({ startDate: sd, endDate: ed, totalPenjualan, totalModal, totalBiaya, laba, labaShared });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/payment-breakdown", async (req, res) => {
    const db = getDb();
    if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    const { startDate, endDate } = req.query;
    const sd = String(startDate ?? "2000-01-01");
    const ed = String(endDate ?? "2099-12-31");

    const pRows = await db.select().from(penjualanTable)
      .where(and(gte(penjualanTable.tanggal, sd), lte(penjualanTable.tanggal, ed)));

    let cash = 0, bank = 0, onlineShop = 0, kredit = 0, kreditCair = 0, onlineShopCair = 0;
    for (const row of pRows) {
      const total = n(row.total);
      if (row.paymentMethod === "cash") cash += total;
      if (row.paymentMethod === "bank") bank += total;
      if (row.paymentMethod === "online_shop") {
        onlineShop += total;
        if (row.statusCair === "cair") onlineShopCair += total;
      }
      if (row.paymentMethod === "kredit") {
        kredit += total;
        if (row.statusCair === "cair") kreditCair += total;
      }
    }

    return res.json({ cash, bank, onlineShop, kredit, kreditCair, onlineShopCair });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/top-products", async (req, res) => {
    const db = getDb();
    if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    const { startDate, endDate, limit } = req.query;
    const sd = String(startDate ?? "2000-01-01");
    const ed = String(endDate ?? "2099-12-31");
    const lim = parseInt(String(limit ?? "10"));

    const pRows = await db.select().from(penjualanTable)
      .where(and(gte(penjualanTable.tanggal, sd), lte(penjualanTable.tanggal, ed)));

    const map = new Map<string, { kodeBarang: string; namaBarang: string; brand: string; totalQty: number; totalPenjualan: number }>();
    for (const row of pRows) {
      if (row.statusCair !== "cair") continue;
      
      const key = row.kodeBarang;
      const existing = map.get(key) ?? { kodeBarang: row.kodeBarang, namaBarang: row.namaBarang, brand: row.brand, totalQty: 0, totalPenjualan: 0 };
      existing.totalQty += row.qty;
      existing.totalPenjualan += n(row.total);
      map.set(key, existing);
    }

    const sorted = Array.from(map.values())
      .sort((a, b) => b.totalPenjualan - a.totalPenjualan)
      .slice(0, lim);

    return res.json(sorted);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
