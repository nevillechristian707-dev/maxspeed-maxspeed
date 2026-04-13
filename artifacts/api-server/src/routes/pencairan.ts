import { Router, type IRouter } from "express";
import { getDb, penjualanTable, transaksiBank } from "../../../../lib/db/src/index";
import { eq, or, gte, lte, and, sql, desc } from "drizzle-orm";

const router: IRouter = Router();

function toNumber(val: unknown): number {
  return parseFloat(String(val ?? "0")) || 0;
}

async function generateKodePencairan(db: any, tanggalCair: string): Promise<string> {
  const month = tanggalCair.substring(0, 7).replace("-", ""); // e.g. "202603"
  // Find the highest sequence number for this month
  const result = await db.execute(sql`
    SELECT kode_pencairan 
    FROM transaksi_bank 
    WHERE kode_pencairan LIKE ${"PC-" + month + "-%"}
    ORDER BY kode_pencairan DESC
    LIMIT 1
  `);
  
  let nextNum = 1;
  if (result.rows.length > 0) {
    const lastKode = String(result.rows[0].kode_pencairan);
    const parts = lastKode.split("-");
    if (parts.length === 3) {
      nextNum = parseInt(parts[2]) + 1;
    }
  }
  
  return `PC-${month}-${String(nextNum).padStart(3, "0")}`;
}

router.get("/", async (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    const { startDate, endDate } = req.query;
    
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
        totalPaid: sql<string>`coalesce(sum(${transaksiBank.nilai}), 0)`,
        kodePencairan: sql<string>`max(${transaksiBank.kodePencairan})`
      })
      .from(penjualanTable)
      .leftJoin(transaksiBank, eq(penjualanTable.id, transaksiBank.penjualanId))
      .where(and(...conditions))
      .groupBy(penjualanTable.id);
    
    const results = rows.map((row: any) => {
        const totalPaid = parseFloat(row.totalPaid);
        const totalAmount = row.paymentMethod === 'online_shop' 
            ? toNumber(row.nilaiOnlineShop) 
            : (row.paymentMethod === 'kredit' ? toNumber(row.nilaiKredit) : toNumber(row.total));
            
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
            kodePencairan: row.kodePencairan || null,
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
    const { tanggalCair, namaBank, rekeningBank, nilai, kodePencairan: existingKode } = req.body;
    const id = parseInt(req.params.id);
    
    const rows = await db.select().from(penjualanTable).where(eq(penjualanTable.id, id));
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    const p = rows[0];

    // Use existing kode or auto-generate new one
    const kodePencairan = existingKode || await generateKodePencairan(db, tanggalCair);

    await db.insert(transaksiBank).values({
      kodePencairan,
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
    
    const totalTarget = p.paymentMethod === 'online_shop' 
        ? toNumber(p.nilaiOnlineShop) 
        : (p.paymentMethod === 'kredit' ? toNumber(p.nilaiKredit) : toNumber(p.total));
    
    const newStatus = totalPaid >= (totalTarget - 0.1) ? "cair" : "partial";

    const updated = await db.update(penjualanTable)
      .set({ 
        statusCair: newStatus, 
        tanggalCair: newStatus === 'cair' ? tanggalCair : p.tanggalCair 
      })
      .where(eq(penjualanTable.id, id))
      .returning();

    return res.json({ ...updated[0], kodePencairan });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/bulk-settle", async (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    const { ids, tanggalCair, namaBank, rekeningBank, kodePencairan: existingKode } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "No IDs provided" });
    }

    const kodePencairan = existingKode || await generateKodePencairan(db, tanggalCair);

    const results = await db.transaction(async (tx) => {
      const updatedRows = [];
      for (const id of ids) {
        const rows = await tx.select().from(penjualanTable).where(eq(penjualanTable.id, id));
        if (!rows.length) continue;
        const p = rows[0];

        const totalTarget = p.paymentMethod === 'online_shop' 
            ? toNumber(p.nilaiOnlineShop) 
            : (p.paymentMethod === 'kredit' ? toNumber(p.nilaiKredit) : toNumber(p.total));

        // Insert bank transaction
        await tx.insert(transaksiBank).values({
          kodePencairan,
          tanggalCair,
          noFaktur: p.noFaktur,
          nilai: String(totalTarget), // For bulk, we assume full settlement
          sumber: p.paymentMethod === 'online_shop' ? 'online_shop' : 'kredit',
          namaBank,
          rekeningBank,
          penjualanId: id
        });

        // Update status to 'cair'
        const updated = await tx.update(penjualanTable)
          .set({ 
            statusCair: "cair", 
            tanggalCair: tanggalCair 
          })
          .where(eq(penjualanTable.id, id))
          .returning();
        
        updatedRows.push(updated[0]);
      }
      return updatedRows;
    });

    return res.json({ success: true, count: results.length, kodePencairan });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/transaksi-bank", async (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    const { startDate, endDate, kodePencairan } = req.query;
    const conditions = [];
    if (startDate) conditions.push(gte(transaksiBank.tanggalCair, String(startDate)));
    if (endDate) conditions.push(lte(transaksiBank.tanggalCair, String(endDate)));
    if (kodePencairan) conditions.push(eq(transaksiBank.kodePencairan, String(kodePencairan)));
    
    const rows = await db.select({
        id: transaksiBank.id,
        kodePencairan: transaksiBank.kodePencairan,
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
        namaCustomer: penjualanTable.namaCustomer,
        tanggal: penjualanTable.tanggal
      })
      .from(transaksiBank)
      .leftJoin(penjualanTable, eq(transaksiBank.penjualanId, penjualanTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(transaksiBank.tanggalCair));
    
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get list of unique kode_pencairan for dropdown
router.get("/kode-pencairan-list", async (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    const { startDate, endDate } = req.query;
    const conditions = [];
    if (startDate) conditions.push(gte(transaksiBank.tanggalCair, String(startDate)));
    if (endDate) conditions.push(lte(transaksiBank.tanggalCair, String(endDate)));

    const rows = await db.select({
      kodePencairan: transaksiBank.kodePencairan,
      tanggalCair: sql<string>`min(${transaksiBank.tanggalCair})`,
      totalNilai: sql<string>`sum(${transaksiBank.nilai})`,
      jumlahItem: sql<number>`count(*)`,
      namaBank: sql<string>`max(${transaksiBank.namaBank})`,
      rekeningBank: sql<string>`max(${transaksiBank.rekeningBank})`,
    })
    .from(transaksiBank)
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(transaksiBank.kodePencairan)
    .orderBy(desc(sql`min(${transaksiBank.tanggalCair})`))
    .limit(1000);

    return res.json(rows.filter((r: any) => r.kodePencairan));
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

// One-time migration: fix duplicate kode pencairan
router.post("/fix-kode-pencairan", async (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    // Get all transactions ordered by date and id
    const allTxs = await db.select()
      .from(transaksiBank)
      .orderBy(transaksiBank.tanggalCair, transaksiBank.id);

    // Group into logical batches: same (original kode, same date) = one batch
    const monthGroups: Record<string, Array<{ originalKode: string; tanggal: string; txIds: number[] }>> = {};

    for (const tx of allTxs) {
      if (!tx.kodePencairan) continue;
      const month = tx.tanggalCair.substring(0, 7).replace("-", "");
      const date = tx.tanggalCair;
      const originalKode = tx.kodePencairan;

      if (!monthGroups[month]) monthGroups[month] = [];

      let batch = monthGroups[month].find(
        (b) => b.originalKode === originalKode && b.tanggal === date
      );
      if (!batch) {
        batch = { originalKode, tanggal: date, txIds: [] };
        monthGroups[month].push(batch);
      }
      batch.txIds.push(tx.id);
    }

    // Re-sequence each month
    let totalUpdated = 0;
    const changes: Array<{ old: string; new: string; date: string; count: number }> = [];

    for (const month of Object.keys(monthGroups).sort()) {
      const batches = monthGroups[month];
      // Sort batches by date, then by original kode for stable ordering
      batches.sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.originalKode.localeCompare(b.originalKode));

      for (let i = 0; i < batches.length; i++) {
        const newSeq = String(i + 1).padStart(3, "0");
        const newKode = `PC-${month}-${newSeq}`;
        const batch = batches[i];

        if (batch.originalKode !== newKode) {
          changes.push({
            old: batch.originalKode,
            new: newKode,
            date: batch.tanggal,
            count: batch.txIds.length,
          });
        }

        for (const id of batch.txIds) {
          await db
            .update(transaksiBank)
            .set({ kodePencairan: newKode })
            .where(eq(transaksiBank.id, id));
          totalUpdated++;
        }
      }
    }

    return res.json({
      success: true,
      totalTransactionsProcessed: totalUpdated,
      changesApplied: changes,
      message: `Migration complete. ${changes.length} kode pencairan were renamed.`,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
