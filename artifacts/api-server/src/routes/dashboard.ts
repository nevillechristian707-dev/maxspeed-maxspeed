import { Router, type IRouter } from "express";
import { getDb, penjualanTable, biayaTable, transaksiBank } from "../../../../lib/db/src/index";
import { gte, lte, and, or, sql, eq } from "drizzle-orm";

const router: IRouter = Router();

function n(val: unknown): number {
  return parseFloat(String(val ?? "0")) || 0;
}

const tbTable = transaksiBank;

router.get("/summary", async (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    const { startDate, endDate } = req.query;

    const s = String(startDate || "0000-01-01");
    const e = String(endDate || "9999-12-31");

    // Gunakan query yang lebih sederhana untuk kestabilan
    const salesRowsRes = await db.execute(sql`
      SELECT 
        p.id, p.total, p.harga_beli, p.qty, p.payment_method, p.status_cair, p.tanggal, p.tanggal_cair,
        (SELECT coalesce(sum(nilai::numeric), 0) FROM transaksi_bank tb WHERE tb.penjualan_id = p.id AND tb.tanggal_cair >= ${s} AND tb.tanggal_cair <= ${e}) as paid_in_period
      FROM penjualan p
      WHERE 
        (p.payment_method IN ('cash', 'bank') AND p.tanggal >= ${s} AND p.tanggal <= ${e})
        OR (p.payment_method IN ('online_shop', 'kredit') AND (
          (p.tanggal_cair >= ${s} AND p.tanggal_cair <= ${e})
          OR EXISTS (
            SELECT 1 FROM transaksi_bank tb 
            WHERE tb.penjualan_id = p.id 
            AND tb.tanggal_cair >= ${s} AND tb.tanggal_cair <= ${e}
          )
        ))
    `);

    const salesRows = salesRowsRes.rows as any[];
    
    let totalPenjualan = 0;
    let totalModal = 0;
    let totalTransaksi = salesRows.length;
    let cashTotal = 0;
    let bankTotal = 0;
    let osTotal = 0;
    let kreditTotal = 0;

    salesRows.forEach(row => {
      const amount = (row.payment_method === 'cash' || row.payment_method === 'bank') ? n(row.total) : n(row.paid_in_period);
      totalPenjualan += amount;
      
      if (row.payment_method === 'cash') cashTotal += amount;
      else if (row.payment_method === 'bank') bankTotal += amount;
      else if (row.payment_method === 'online_shop') osTotal += amount;
      else if (row.payment_method === 'kredit') kreditTotal += amount;

      // Modal dihitung hanya jika cair atau cash/bank
      const isCairInPeriod = (row.payment_method === 'online_shop' || row.payment_method === 'kredit') ? (row.status_cair === 'cair' && String(row.tanggal_cair) >= s && String(row.tanggal_cair) <= e) : true;
      if (isCairInPeriod) {
        totalModal += n(row.harga_beli) * n(row.qty);
      }
    });

    // Ambil Pending data (Belum Cair)
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

    const bRows = await db.select().from(biayaTable)
      .where(and(gte(biayaTable.tanggal, s), lte(biayaTable.tanggal, e)));

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
      onlineShopTotal: osTotal,
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
    console.error("Dashboard Summary Error:", err);
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
