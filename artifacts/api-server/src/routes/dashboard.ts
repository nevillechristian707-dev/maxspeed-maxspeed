import { Router, type IRouter } from "express";
import { getDb, penjualanTable, biayaTable, transaksiBank } from "../../../../lib/db/src/index";
import { gte, lte, and, or, sql, eq } from "drizzle-orm";

const router: IRouter = Router();

function n(val: unknown): number {
  return parseFloat(String(val ?? "0")) || 0;
}

router.get("/summary", async (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    const { startDate, endDate } = req.query;
    
    // Core logic: 
    // - For Cash/Bank: Use 'tanggal'.
    // - For Online Shop/Kredit: Total Penjualan only counts if 'tanggalCair' is in period.
    // - Outstanding stats: Items sold 'tanggal' <= endDate AND (pending/partial).

    const s = String(startDate || "0000-01-01");
    const e = String(endDate || "9999-12-31");

    // We fetch all relevant items: 
    // 1. Sold in period (regardless of status, for "total activity" or "pending" detection)
    // 2. Liquidated in period (regardless of when sold, for "Total Penjualan" recap)
    const pRows = await db.select({
      id: penjualanTable.id,
      tanggal: penjualanTable.tanggal,
      total: penjualanTable.total,
      hargaBeli: penjualanTable.hargaBeli,
      qty: penjualanTable.qty,
      paymentMethod: penjualanTable.paymentMethod,
      statusCair: penjualanTable.statusCair,
      tanggalCair: penjualanTable.tanggalCair,
      totalPaidInRange: sql<string>`(select coalesce(sum(${transaksiBank.nilai}), 0) from ${transaksiBank} where ${transaksiBank.penjualanId} = ${penjualanTable.id} and ${transaksiBank.tanggalCair} >= ${s} and ${transaksiBank.tanggalCair} <= ${e})`,
      totalPaidAllTime: sql<string>`(select coalesce(sum(${transaksiBank.nilai}), 0) from ${transaksiBank} where ${transaksiBank.penjualanId} = ${penjualanTable.id})`
    }).from(penjualanTable)
    .where(or(
      and(gte(penjualanTable.tanggal, s), lte(penjualanTable.tanggal, e)),
      and(gte(penjualanTable.tanggalCair, s), lte(penjualanTable.tanggalCair, e))
    ));

    let totalPenjualan = 0;
    let totalModal = 0;
    let totalTransaksi = 0;
    let cashTotal = 0;
    let bankTotal = 0;
    let onlineShopTotal = 0;
    let kreditTotal = 0;
    let onlineShopBelumCair = 0;
    let kreditBelumCair = 0;

    pRows.forEach((row: any) => {
      const val = n(row.total);
      const modalVal = n(row.hargaBeli) * n(row.qty);
      const isCashOrBank = row.paymentMethod === 'cash' || row.paymentMethod === 'bank';
      
      // 1. Total Penjualan Recap (Hanya yang cair/masuk di bulan ini)
      if (isCashOrBank) {
        if (row.tanggal >= s && row.tanggal <= e) {
          totalPenjualan += val;
          totalModal += modalVal;
          totalTransaksi++;
          if (row.paymentMethod === 'cash') cashTotal += val;
          if (row.paymentMethod === 'bank') bankTotal += val;
        }
      } else {
        // Online Shop / Kredit: Only count the amount LIQUIDATED in this period
        const paidInPeriod = n(row.totalPaidInRange);
        if (paidInPeriod > 0) {
          totalPenjualan += paidInPeriod;
          // For modal, we approximate: if it's fully liquidated in this period, count full modal
          // Or if it's the first payment? Let's keep it simple: if it's finalized (cair) in this range, count modal.
          if (row.statusCair === 'cair' && row.tanggalCair && row.tanggalCair >= s && row.tanggalCair <= e) {
             totalModal += modalVal;
          }
          if (row.paymentMethod === 'online_shop') onlineShopTotal += paidInPeriod;
          if (row.paymentMethod === 'kredit') kreditTotal += paidInPeriod;
        }
      }

      // 2. Belum Cair Recap (Outstanding as of end of period)
      // Any item sold up to 'e' that is not yet fully paid
      if (!isCashOrBank && row.tanggal <= e) {
        const remaining = val - n(row.totalPaidAllTime);
        if (remaining > 0) {
          if (row.paymentMethod === 'online_shop') onlineShopBelumCair += remaining;
          if (row.paymentMethod === 'kredit') kreditBelumCair += remaining;
        }
      }
    });

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
    const format = "YYYY-MM-DD";
    
    // For chart, we need to combine:
    // 1. Cash/Bank by 'tanggal'
    // 2. Online/Kredit by 'tanggalCair' (from transaksiBank)
    
    const cashData = await db.select({
      label: sql<string>`to_char(${penjualanTable.tanggal}::date, ${format})`,
      val: sql<string>`sum(${penjualanTable.total})`,
      mod: sql<string>`sum(${penjualanTable.hargaBeli} * ${penjualanTable.qty})`,
    })
    .from(penjualanTable)
    .where(or(eq(penjualanTable.paymentMethod, 'cash'), eq(penjualanTable.paymentMethod, 'bank')))
    .groupBy(sql`to_char(${penjualanTable.tanggal}::date, ${format})`);

    const liquidData = await db.select({
      label: sql<string>`to_char(${transaksiBank.tanggalCair}::date, ${format})`,
      val: sql<string>`sum(${transaksiBank.nilai})`,
      // Modal is tricky for partials in chart, we'll map modal to the final 'cair' date
    })
    .from(transaksiBank)
    .groupBy(sql`to_char(${transaksiBank.tanggalCair}::date, ${format})`);

    // Map by date
    const merged: Record<string, { penjualan: number; laba: number }> = {};
    
    cashData.forEach((d: any) => {
      if (!merged[d.label]) merged[d.label] = { penjualan: 0, laba: 0 };
      merged[d.label].penjualan += n(d.val);
      merged[d.label].laba += (n(d.val) - n(d.mod));
    });

    liquidData.forEach((d: any) => {
      if (!merged[d.label]) merged[d.label] = { penjualan: 0, laba: 0 };
      merged[d.label].penjualan += n(d.val);
      // Simplified laba for credit items in chart: count profit only when liquidated? 
      // For now, let's keep it consistent with totalPenjualan.
      merged[d.label].laba += n(d.val); 
    });

    const labels = Object.keys(merged).sort();
    return res.json({
      labels,
      penjualan: labels.map(l => merged[l].penjualan),
      laba: labels.map(l => merged[l].laba),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
