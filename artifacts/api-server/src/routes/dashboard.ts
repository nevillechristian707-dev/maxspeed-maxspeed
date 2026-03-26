import { Router, type IRouter } from "express";
import { getDb, penjualanTable, biayaTable, transaksiBank } from "../../../../lib/db/src/index";
import { gte, lte, and, or, sql, eq } from "drizzle-orm";

const router: IRouter = Router();

function n(val: unknown): number {
  return parseFloat(String(val ?? "0")) || 0;
}

// Alias to avoid any name collision
const tbTable = transaksiBank;

router.get("/summary", async (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    const { startDate, endDate } = req.query;

    const s = String(startDate || "0000-01-01");
    const e = String(endDate || "9999-12-31");

    // Fetch items sold or settled in this period
    const pRows = await db.select({
      id: penjualanTable.id,
      tanggal: penjualanTable.tanggal,
      total: penjualanTable.total,
      hargaBeli: penjualanTable.hargaBeli,
      qty: penjualanTable.qty,
      paymentMethod: penjualanTable.paymentMethod,
      statusCair: penjualanTable.statusCair,
      tanggalCair: penjualanTable.tanggalCair,
      totalPaidInRange: sql<string>`coalesce(sum(case when ${tbTable.tanggalCair} >= ${s} and ${tbTable.tanggalCair} <= ${e} then ${tbTable.nilai} else 0 end), 0)`,
      totalPaidAllTime: sql<string>`coalesce(sum(${tbTable.nilai}), 0)`
    }).from(penjualanTable)
    .leftJoin(tbTable, eq(penjualanTable.id, tbTable.penjualanId))
    .where(or(
      and(gte(penjualanTable.tanggal, s), lte(penjualanTable.tanggal, e)),
      and(gte(penjualanTable.tanggalCair, s), lte(penjualanTable.tanggalCair, e))
    ))
    .groupBy(penjualanTable.id);

    let totalPenjualan = 0;
    let totalModal = 0;
    let totalTransaksi = 0;
    let cashTotal = 0;
    let bankTotal = 0;
    let onlineShopTotal = 0;
    let kreditTotal = 0;

    pRows.forEach((row: any) => {
      const val = n(row.total);
      const modalVal = n(row.hargaBeli) * n(row.qty);
      const isCashOrBank = row.paymentMethod === 'cash' || row.paymentMethod === 'bank';

      if (isCashOrBank) {
        if (row.tanggal >= s && row.tanggal <= e) {
          totalPenjualan += val;
          totalModal += modalVal;
          totalTransaksi++;
          if (row.paymentMethod === 'cash') cashTotal += val;
          if (row.paymentMethod === 'bank') bankTotal += val;
        }
      } else {
        const paidInPeriod = n(row.totalPaidInRange);
        if (paidInPeriod > 0) {
          totalPenjualan += paidInPeriod;
          if (row.statusCair === 'cair' && row.tanggalCair && row.tanggalCair >= s && row.tanggalCair <= e) {
             totalModal += modalVal;
          }
          if (row.paymentMethod === 'online_shop') onlineShopTotal += paidInPeriod;
          if (row.paymentMethod === 'kredit') kreditTotal += paidInPeriod;
        }
      }
    });

    // Use raw SQL to avoid ORM table resolution issues
    const pendingResult = await db.execute(sql`
      SELECT p.payment_method, 
             SUM(p.total::numeric - COALESCE(tb_sum.total_paid, 0)) as remaining
      FROM penjualan p
      LEFT JOIN (
        SELECT penjualan_id, SUM(nilai::numeric) as total_paid 
        FROM transaksi_bank 
        GROUP BY penjualan_id
      ) tb_sum ON p.id = tb_sum.penjualan_id
      WHERE p.tanggal <= ${e}
        AND p.status_cair IN ('pending', 'partial')
        AND p.payment_method IN ('online_shop', 'kredit')
        AND (p.total::numeric - COALESCE(tb_sum.total_paid, 0)) > 0
      GROUP BY p.payment_method
    `);

    let onlineShopBelumCair = 0;
    let kreditBelumCair = 0;
    if (pendingResult && pendingResult.rows) {
      pendingResult.rows.forEach((row: any) => {
        if (row.payment_method === 'online_shop') onlineShopBelumCair = n(row.remaining);
        if (row.payment_method === 'kredit') kreditBelumCair = n(row.remaining);
      });
    }


    const bConds: any[] = [];
    if (startDate) bConds.push(gte(biayaTable.tanggal, String(startDate)));
    if (endDate) bConds.push(lte(biayaTable.tanggal, String(endDate)));

    const bRows = await db.select().from(biayaTable)
      .where(bConds.length ? and(...bConds) : undefined);

    const totalBiaya = bRows.reduce((sum: number, r: any) => sum + n(r.nilai), 0);
    const laba = totalPenjualan - totalModal - totalBiaya;
    const labaShared = laba * 0.1;

    return res.json({
      totalPenjualan,
      totalModal,
      totalBiaya,
      laba,
      labaShared,
      totalTransaksi,
      cashTotal,
      bankTotal,
      onlineShopTotal,
      kreditTotal,
      kreditBelumCair,
      onlineShopBelumCair,
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
    const { startDate, endDate } = req.query;
    const conds = [];
    if (startDate) conds.push(gte(penjualanTable.tanggal, String(startDate)));
    if (endDate) conds.push(lte(penjualanTable.tanggal, String(endDate)));

    const chartRows = await db.select({
      label: penjualanTable.tanggal,
      count: sql<number>`count(*)`,
      penjualan: sql<string>`sum(${penjualanTable.total})`,
      modal: sql<string>`sum(${penjualanTable.hargaBeli} * ${penjualanTable.qty})`,
      cash: sql<string>`sum(case when ${penjualanTable.paymentMethod} = 'cash' then ${penjualanTable.total}::numeric else 0 end)`,
      bank: sql<string>`sum(case when ${penjualanTable.paymentMethod} = 'bank' then ${penjualanTable.total}::numeric else 0 end)`,
      onlineShop: sql<string>`sum(case when ${penjualanTable.paymentMethod} = 'online_shop' then ${penjualanTable.total}::numeric else 0 end)`,
      kredit: sql<string>`sum(case when ${penjualanTable.paymentMethod} = 'kredit' then ${penjualanTable.total}::numeric else 0 end)`,
    })
    .from(penjualanTable)
    .where(conds.length ? and(...conds) : undefined)
    .groupBy(penjualanTable.tanggal)
    .orderBy(penjualanTable.tanggal);

    const labels = chartRows.map((r: any) => r.label);
    const penjualan = chartRows.map((r: any) => n(r.penjualan));
    const laba = chartRows.map((r: any) => n(r.penjualan) - n(r.modal));
    const counts = chartRows.map((r: any) => n(r.count));
    const cash = chartRows.map((r: any) => n(r.cash));
    const bank = chartRows.map((r: any) => n(r.bank));
    const onlineShop = chartRows.map((r: any) => n(r.onlineShop));
    const kredit = chartRows.map((r: any) => n(r.kredit));

    return res.json({
      labels,
      penjualan,
      laba,
      counts,
      cash,
      bank,
      onlineShop,
      kredit
    });
  } catch (err: any) {
    console.error("GET /api/dashboard/chart error:", err);
    return res.status(500).json({ 
      error: "Internal Server Error", 
      message: err.message, 
      detail: err.detail || err.cause?.message || "Check server logs for details"
    });
  }
});

export default router;
