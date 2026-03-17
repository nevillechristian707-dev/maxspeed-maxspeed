import { Router, type IRouter } from "express";
import { getDb, penjualanTable, biayaTable, transaksiBank } from "../../../../lib/db/src/index";
import { gte, lte, and, sql, eq } from "drizzle-orm";

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

    // Single aggregate query for sales metrics
    const pStats = await db.select({
      totalPenjualan: sql<string>`sum(${penjualanTable.total})`,
      totalModal: sql<string>`sum(${penjualanTable.hargaBeli} * ${penjualanTable.qty})`,
      totalTransaksi: sql<string>`count(${penjualanTable.id})`,
      cashTotal: sql<string>`sum(case when ${penjualanTable.paymentMethod} = 'cash' then ${penjualanTable.total} else '0' end)`,
      bankTotal: sql<string>`sum(case when ${penjualanTable.paymentMethod} = 'bank' then ${penjualanTable.total} else '0' end)`,
      onlineShopTotal: sql<string>`sum(case when ${penjualanTable.paymentMethod} = 'online_shop' then ${penjualanTable.total} else '0' end)`,
      onlineShopBelumCair: sql<string>`sum(case when ${penjualanTable.paymentMethod} = 'online_shop' and (${penjualanTable.statusCair} = 'pending' or ${penjualanTable.statusCair} = 'partial') then (${penjualanTable.total} - coalesce((select sum(${transaksiBank.nilai}) from ${transaksiBank} where ${transaksiBank.penjualanId} = ${penjualanTable.id}), 0)) else '0' end)`,
      kreditTotal: sql<string>`sum(case when ${penjualanTable.paymentMethod} = 'kredit' then ${penjualanTable.total} else '0' end)`,
      kreditBelumCair: sql<string>`sum(case when ${penjualanTable.paymentMethod} = 'kredit' and (${penjualanTable.statusCair} = 'pending' or ${penjualanTable.statusCair} = 'partial') then (${penjualanTable.total} - coalesce((select sum(${transaksiBank.nilai}) from ${transaksiBank} where ${transaksiBank.penjualanId} = ${penjualanTable.id}), 0)) else '0' end)`,
    }).from(penjualanTable)
    .where(pConds.length ? and(...pConds) : undefined);

    const metrics = pStats[0];

    const bRows = await db.select().from(biayaTable)
      .where(bConds.length ? and(...bConds) : undefined);

    const totalBiaya = bRows.reduce((s: number, r: any) => s + n(r.nilai), 0);
    const laba = n(metrics.totalPenjualan) - n(metrics.totalModal) - totalBiaya;
    const labaShared = laba * 0.1;

    return res.json({
      totalPenjualan: n(metrics.totalPenjualan),
      totalModal: n(metrics.totalModal),
      totalBiaya,
      laba,
      labaShared,
      totalTransaksi: parseInt(metrics.totalTransaksi || "0"),
      cashTotal: n(metrics.cashTotal),
      bankTotal: n(metrics.bankTotal),
      onlineShopTotal: n(metrics.onlineShopTotal),
      kreditTotal: n(metrics.kreditTotal),
      kreditBelumCair: n(metrics.kreditBelumCair),
      onlineShopBelumCair: n(metrics.onlineShopBelumCair),
      biayaItems: bRows.map((r: any) => ({
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
    const format = "YYYY-MM-DD";
    const chartData = await db.select({
      label: sql<string>`to_char(${penjualanTable.tanggal}::date, ${format})`,
      penjualan: sql<string>`sum(${penjualanTable.total})`,
      modal: sql<string>`sum(${penjualanTable.hargaBeli} * ${penjualanTable.qty})`,
    })
    .from(penjualanTable)
    .groupBy(sql`to_char(${penjualanTable.tanggal}::date, ${format})`)
    .orderBy(sql`to_char(${penjualanTable.tanggal}::date, ${format})`);

    return res.json({
      labels: chartData.map((d: any) => d.label),
      penjualan: chartData.map((d: any) => n(d.penjualan)),
      laba: chartData.map((d: any) => n(d.penjualan) - n(d.modal)),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
