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

    // Gunakan 1 query aggregate untuk performa maksimal
    // Logika: Cash/Bank dihitung dari tanggal transaksi, Online/Kredit dihitung dari range pencairan (nilai cair)
    const summaryQuery = await db.execute(sql`
      WITH filtered_sales AS (
        SELECT 
          id, total, harga_beli, qty, payment_method, status_cair, tanggal, tanggal_cair
        FROM penjualan
        WHERE 
          (payment_method IN ('cash', 'bank') AND tanggal >= ${s} AND tanggal <= ${e})
          OR (payment_method IN ('online_shop', 'kredit') AND (
            (tanggal_cair >= ${s} AND tanggal_cair <= ${e})
            OR EXISTS (
              SELECT 1 FROM transaksi_bank tb 
              WHERE tb.penjualan_id = penjualan.id 
              AND tb.tanggal_cair >= ${s} AND tb.tanggal_cair <= ${e}
            )
          ))
      ),
      payment_stats AS (
        SELECT 
          id,
          CASE 
            WHEN payment_method IN ('cash', 'bank') THEN total::numeric
            ELSE (SELECT coalesce(sum(nilai::numeric), 0) FROM transaksi_bank WHERE penjualan_id = filtered_sales.id AND tanggal_cair >= ${s} AND tanggal_cair <= ${e})
          END as amount_in_period,
          harga_beli::numeric * qty as modal_total
        FROM filtered_sales
      )
      SELECT 
        coalesce(sum(amount_in_period), 0) as total_penjualan,
        (SELECT coalesce(sum(harga_beli::numeric * qty), 0) FROM filtered_sales 
         WHERE (payment_method IN ('cash', 'bank')) OR (payment_method IN ('online_shop', 'kredit') AND status_cair = 'cair' AND tanggal_cair >= ${s} AND tanggal_cair <= ${e})) as total_modal,
        count(distinct id) as total_transaksi,
        coalesce(sum(CASE WHEN payment_method = 'cash' THEN amount_in_period ELSE 0 END), 0) as cash_total,
        coalesce(sum(CASE WHEN payment_method = 'bank' THEN amount_in_period ELSE 0 END), 0) as bank_total,
        coalesce(sum(CASE WHEN payment_method = 'online_shop' THEN amount_in_period ELSE 0 END), 0) as os_total,
        coalesce(sum(CASE WHEN payment_method = 'kredit' THEN amount_in_period ELSE 0 END), 0) as kredit_total
      FROM filtered_sales
      LEFT JOIN payment_stats ON filtered_sales.id = payment_stats.id
    `);

    const result = (summaryQuery.rows && summaryQuery.rows.length > 0) ? (summaryQuery.rows[0] as any) : {
      total_penjualan: 0,
      total_modal: 0,
      total_transaksi: 0,
      cash_total: 0,
      bank_total: 0,
      os_total: 0,
      kredit_total: 0
    };
    const totalPenjualan = n(result.total_penjualan);
    const totalModal = n(result.total_modal);
    
    // Ambil Pending data (Belum Cair) - Sudah cepat
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
      totalTransaksi: n(result.total_transaksi),
      cashTotal: n(result.cash_total),
      bankTotal: n(result.bank_total),
      onlineShopTotal: n(result.os_total),
      kreditTotal: n(result.kredit_total),
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
