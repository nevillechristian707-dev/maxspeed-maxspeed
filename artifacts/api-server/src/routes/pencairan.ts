import { Router, type IRouter } from "express";
import { getDb, penjualanTable, transaksiBank } from "../../../../lib/db/src/index";
import { eq, or, gte, lte, and, sql } from "drizzle-orm";

const router: IRouter = Router();

function toNumber(val: unknown): number {
  return parseFloat(String(val ?? "0")) || 0;
}

router.get("/", async (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    const { startDate, endDate } = req.query;
    
    // Logic for persistence:
    // Show if (in month) OR (unpaid and before month) OR (paid in month)
    const conditions = [];
    if (startDate && endDate) {
        conditions.push(or(
          and(gte(penjualanTable.tanggal, String(startDate)), lte(penjualanTable.tanggal, String(endDate))),
          and(
            lte(penjualanTable.tanggal, String(endDate)),
            or(
              eq(penjualanTable.statusCair, "pending"),
              eq(penjualanTable.statusCair, "partial"),
              and(
                eq(penjualanTable.statusCair, "cair"),
                gte(penjualanTable.tanggalCair, String(startDate)),
                lte(penjualanTable.tanggalCair, String(endDate))
              )
            ),
            or(
              eq(penjualanTable.paymentMethod, "online_shop"),
              eq(penjualanTable.paymentMethod, "kredit")
            )
          )
        ));
    } else {
        conditions.push(or(
          eq(penjualanTable.paymentMethod, "online_shop"),
          eq(penjualanTable.paymentMethod, "kredit")
        ));
    }

    const rows = await db.select({
        ...penjualanTable,
        totalPaid: sql<string>`coalesce(sum(${transaksiBank.nilai}), 0)`
      })
      .from(penjualanTable)
      .leftJoin(transaksiBank, eq(penjualanTable.id, transaksiBank.penjualanId))
      .where(and(...conditions))
      .groupBy(penjualanTable.id);
    
    const results = rows.map((row: any) => {
        const totalPaid = parseFloat(row.totalPaid);
        const totalAmount = toNumber(row.total);
        return {
            id: row.id,
            tanggal: row.tanggal,
            kodeTransaksi: row.kodeTransaksi,
            noFaktur: row.noFaktur,
            namaBarang: row.namaBarang,
            brand: row.brand,
            paymentMethod: row.paymentMethod,
            namaOnlineShop: row.namaOnlineShop,
            namaCustomer: row.namaCustomer,
            totalAmount: totalAmount,
            totalPaid: totalPaid,
            nilai: totalAmount - totalPaid,
            status: row.statusCair ?? "pending",
            tanggalCair: row.tanggalCair,
        };
    });
      
    return res.json(results);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/:id/mark-settled", async (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    const { tanggalCair, namaBank, rekeningBank, nilai } = req.body;
    const id = parseInt(req.params.id);
    
    const rows = await db.select().from(penjualanTable).where(eq(penjualanTable.id, id));
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    const p = rows[0];

    await db.insert(transaksiBank).values({
      tanggalCair,
      noFaktur: p.noFaktur,
      nilai: String(nilai),
      sumber: p.paymentMethod === 'online_shop' ? 'online_shop' : 'kredit',
      namaBank,
      rekeningBank,
      penjualanId: id
    });

    const txs = await db.select({ total: sql<string>`sum(nilai)` })
      .from(transaksiBank)
      .where(eq(transaksiBank.penjualanId, id));
    
    const totalPaid = parseFloat(txs[0]?.total || "0");
    const totalTarget = p.paymentMethod === 'online_shop' ? toNumber(p.nilaiOnlineShop) : toNumber(p.nilaiKredit);
    
    const newStatus = totalPaid >= (totalTarget - 1) ? "cair" : "partial"; // -1 to handle float rounding

    const updated = await db.update(penjualanTable)
      .set({ 
        statusCair: newStatus, 
        tanggalCair: newStatus === 'cair' ? tanggalCair : p.tanggalCair 
      })
      .where(eq(penjualanTable.id, id))
      .returning();

    return res.json(updated[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/transaksi-bank", async (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    const { startDate, endDate } = req.query;
    const conditions = [];
    if (startDate) conditions.push(gte(transaksiBank.tanggalCair, String(startDate)));
    if (endDate) conditions.push(lte(transaksiBank.tanggalCair, String(endDate)));
    
    const rows = await db.select({
        id: transaksiBank.id,
        tanggalCair: transaksiBank.tanggalCair,
        noFaktur: transaksiBank.noFaktur,
        nilai: transaksiBank.nilai,
        sumber: transaksiBank.sumber,
        namaBank: transaksiBank.namaBank,
        rekeningBank: transaksiBank.rekeningBank,
        penjualanId: transaksiBank.penjualanId,
        namaBarang: penjualanTable.namaBarang,
        kodeBarang: penjualanTable.kodeBarang,
        brand: penjualanTable.brand,
        kodeTransaksi: penjualanTable.kodeTransaksi,
        namaOnlineShop: penjualanTable.namaOnlineShop,
        namaCustomer: penjualanTable.namaCustomer
      })
      .from(transaksiBank)
      .leftJoin(penjualanTable, eq(transaksiBank.penjualanId, penjualanTable.id))
      .where(conditions.length ? and(...conditions) : undefined);
    
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/:id/cancel-settled", async (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    const id = parseInt(req.params.id);
    await db.delete(transaksiBank).where(eq(transaksiBank.penjualanId, id));
    const updated = await db.update(penjualanTable)
      .set({ statusCair: "pending", tanggalCair: null })
      .where(eq(penjualanTable.id, id))
      .returning();
    if (!updated.length) return res.status(404).json({ error: "Not found" });
    return res.json(updated[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
