import { Router, type IRouter } from "express";
import { getDb, penjualanTable, biayaTable } from "../../../../lib/db/src/index";
import { gte, lte, and, sql, eq } from "drizzle-orm";

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

    if (process.env.DEBUG_REPORT === "true") {
      console.log(`[DEBUG REPORT] /profit: startDate=${sd}, endDate=${ed}`);
    }

    const pStats = await db.select({
      totalPenjualan: sql<string>`sum(case when ${penjualanTable.statusCair} = 'cair' then ${penjualanTable.total} else '0' end)`,
      totalModal: sql<string>`sum(case when ${penjualanTable.statusCair} = 'cair' then ${penjualanTable.hargaBeli} * ${penjualanTable.qty} else 0 end)`,
    }).from(penjualanTable).where(and(gte(penjualanTable.tanggal, sd), lte(penjualanTable.tanggal, ed)));

    const bStats = await db.select({
      totalBiaya: sql<string>`sum(${biayaTable.nilai}::numeric)`,
    }).from(biayaTable).where(and(gte(biayaTable.tanggal, sd), lte(biayaTable.tanggal, ed)));

    if (process.env.DEBUG_REPORT === "true") {
      console.log(`[DEBUG REPORT] /profit: bStats=${JSON.stringify(bStats)}`);
    }

    const tPenjualan = n(pStats[0].totalPenjualan);
    const tModal = n(pStats[0].totalModal);
    const tBiaya = n(bStats[0].totalBiaya);
    const laba = tPenjualan - tModal - tBiaya;
    const labaShared = laba * 0.1;

    return res.json({ 
      startDate: sd, 
      endDate: ed, 
      totalPenjualan: tPenjualan, 
      totalModal: tModal, 
      totalBiaya: tBiaya, 
      laba, 
      labaShared 
    });
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

    const stats = await db.select({
      cash: sql<string>`sum(case when ${penjualanTable.paymentMethod} = 'cash' then ${penjualanTable.total} else '0' end)`,
      bank: sql<string>`sum(case when ${penjualanTable.paymentMethod} = 'bank' then ${penjualanTable.total} else '0' end)`,
      onlineShop: sql<string>`sum(case when ${penjualanTable.paymentMethod} = 'online_shop' then ${penjualanTable.total} else '0' end)`,
      kredit: sql<string>`sum(case when ${penjualanTable.paymentMethod} = 'kredit' then ${penjualanTable.total} else '0' end)`,
      kreditCair: sql<string>`sum(case when ${penjualanTable.paymentMethod} = 'kredit' and ${penjualanTable.statusCair} = 'cair' then ${penjualanTable.total} else '0' end)`,
      onlineShopCair: sql<string>`sum(case when ${penjualanTable.paymentMethod} = 'online_shop' and ${penjualanTable.statusCair} = 'cair' then ${penjualanTable.total} else '0' end)`,
    }).from(penjualanTable).where(and(gte(penjualanTable.tanggal, sd), lte(penjualanTable.tanggal, ed)));

    const item = stats[0];
    return res.json({ 
      cash: n(item.cash), 
      bank: n(item.bank), 
      onlineShop: n(item.onlineShop), 
      kredit: n(item.kredit), 
      kreditCair: n(item.kreditCair), 
      onlineShopCair: n(item.onlineShopCair) 
    });
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

    const topProducts = await db.select({
      kodeBarang: penjualanTable.kodeBarang,
      namaBarang: penjualanTable.namaBarang,
      brand: penjualanTable.brand,
      totalQty: sql<number>`sum(${penjualanTable.qty})`,
      totalPenjualan: sql<string>`sum(${penjualanTable.total})`,
    })
    .from(penjualanTable)
    .where(and(gte(penjualanTable.tanggal, sd), lte(penjualanTable.tanggal, ed), eq(penjualanTable.statusCair, 'cair')))
    .groupBy(penjualanTable.kodeBarang, penjualanTable.namaBarang, penjualanTable.brand)
    .orderBy(sql`sum(${penjualanTable.total}) desc`)
    .limit(lim);

    return res.json(topProducts.map(p => ({
      ...p,
      totalQty: Number(p.totalQty),
      totalPenjualan: n(p.totalPenjualan)
    })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
