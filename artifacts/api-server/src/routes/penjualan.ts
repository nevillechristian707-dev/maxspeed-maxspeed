import { Router, type IRouter } from "express";
import { getDb, penjualanTable, masterBarangTable, transaksiBank } from "../../../../lib/db/src/index";
import { eq, gte, lte, and, or, sql, desc } from "drizzle-orm";

const router: IRouter = Router();

function toNumber(val: unknown): number {
  return parseFloat(String(val ?? "0")) || 0;
}

router.get("/", async (req, res) => {
    const db = getDb();
    if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    const { startDate, endDate, paymentMethod } = req.query;
    
    let conditions = [];
    if (startDate && endDate) {
      // Logic for persistence: 
      // Show if (sold in this period) OR (sold before and still unpaid/partially paid) OR (settled in this period)
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
    }

    if (paymentMethod) {
       // if paymentMethod is provided explicitly, we could further filter
       // but for now let's keep the main logic
    }

    const rows = await db.select({
        ...penjualanTable,
        totalPaid: sql<string>`coalesce(sum(${transaksiBank.nilai}), 0)`
      })
      .from(penjualanTable)
      .leftJoin(transaksiBank, eq(penjualanTable.id, transaksiBank.penjualanId))
      .where(conditions.length ? and(...conditions) : undefined)
      .groupBy(penjualanTable.id)
      .orderBy(desc(penjualanTable.tanggal), desc(penjualanTable.nomor));
    
    return res.json(rows.map((row: any) => toDto({ ...row, totalPaid: parseFloat(row.totalPaid) })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", async (req, res) => {
    const db = getDb();
    if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    const { tanggal, kodeBarang, harga, qty, paymentMethod, noFaktur,
      nilaiCash, namaBank, nilaiBank, namaOnlineShop, nilaiOnlineShop,
      namaCustomer, nilaiKredit } = req.body;

    const barang = await db.select().from(masterBarangTable)
      .where(eq(masterBarangTable.kodeBarang, kodeBarang));
    if (!barang.length) return res.status(400).json({ error: "Barang not found" });

    const b = barang[0];
    const hargaNum = parseFloat(String(harga));
    const qtyNum = parseInt(String(qty));
    const total = hargaNum * qtyNum;
    const hargaBeli = parseFloat(String(b.hargaBeli));
    const totalModal = hargaBeli * qtyNum;

    const maxNomorResult = await db.select({ maxNomor: sql<number>`max(${penjualanTable.nomor})` })
      .from(penjualanTable)
      .where(eq(penjualanTable.tanggal, tanggal));
    
    // Fallback if no transactions yet today
    const currentMax = Number(maxNomorResult[0]?.maxNomor || 0);
    const dayCount = currentMax + 1;
    
    const dateStr = tanggal.replace(/-/g, "");
    const nomor = dayCount;
    const kodeTransaksi = `TRX-${dateStr}-${String(nomor).padStart(3, "0")}`;

    const needsCair = paymentMethod === "online_shop" || paymentMethod === "kredit";

    const inserted = await db.insert(penjualanTable).values({
      tanggal,
      nomor,
      kodeTransaksi,
      noFaktur: noFaktur || null,
      kodeBarang,
      namaBarang: b.namaBarang,
      brand: b.brand,
      harga: String(hargaNum),
      qty: qtyNum,
      total: String(total),
      paymentMethod,
      nilaiCash: paymentMethod === "cash" ? String(nilaiCash || total) : null,
      namaBank: paymentMethod === "bank" ? (namaBank || null) : null,
      nilaiBank: paymentMethod === "bank" ? String(nilaiBank || total) : null,
      namaOnlineShop: paymentMethod === "online_shop" ? (namaOnlineShop || null) : null,
      nilaiOnlineShop: paymentMethod === "online_shop" ? String(nilaiOnlineShop || total) : null,
      namaCustomer: paymentMethod === "kredit" ? (namaCustomer || null) : null,
      nilaiKredit: paymentMethod === "kredit" ? String(nilaiKredit || total) : null,
      statusCair: needsCair ? "pending" : "cair",
      tanggalCair: null,
      hargaBeli: String(hargaBeli),
      totalModal: String(totalModal),
    }).returning();

    return res.status(201).json(toDto(inserted[0]));
  } catch (err: any) {
    console.error("POST /api/penjualan error:", err);
    return res.status(500).json({ 
      error: "Internal Server Error", 
      message: err.message, 
      detail: err.detail || err.cause?.message || "Check server logs for details" 
    });
  }
});

router.get("/:id", async (req, res) => {
    const db = getDb();
    if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    const rows = await db.select().from(penjualanTable).where(eq(penjualanTable.id, parseInt(req.params.id)));
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    return res.json(toDto(rows[0]));
  } catch (err) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/:id", async (req, res) => {
    const db = getDb();
    if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    const id = parseInt(req.params.id);
    const { tanggal, kodeBarang, harga, qty, paymentMethod, noFaktur,
      nilaiCash, namaBank, nilaiBank, namaOnlineShop, nilaiOnlineShop,
      namaCustomer, nilaiKredit } = req.body;

    const barang = await db.select().from(masterBarangTable).where(eq(masterBarangTable.kodeBarang, kodeBarang));
    if (!barang.length) return res.status(400).json({ error: "Barang not found" });
    const b = barang[0];
    const hargaNum = parseFloat(String(harga));
    const qtyNum = parseInt(String(qty));
    const total = hargaNum * qtyNum;
    const hargaBeli = parseFloat(String(b.hargaBeli));
    const totalModal = hargaBeli * qtyNum;
    const needsCair = paymentMethod === "online_shop" || paymentMethod === "kredit";

    const updated = await db.update(penjualanTable).set({
      tanggal, kodeBarang, namaBarang: b.namaBarang, brand: b.brand,
      noFaktur: noFaktur || null,
      harga: String(hargaNum), qty: qtyNum, total: String(total),
      paymentMethod,
      nilaiCash: nilaiCash != null ? String(nilaiCash) : null,
      namaBank: namaBank || null, nilaiBank: nilaiBank != null ? String(nilaiBank) : null,
      namaOnlineShop: namaOnlineShop || null, nilaiOnlineShop: nilaiOnlineShop != null ? String(nilaiOnlineShop) : String(total),
      namaCustomer: namaCustomer || null, nilaiKredit: nilaiKredit != null ? String(nilaiKredit) : String(total),
      statusCair: needsCair ? "pending" : "cair",
      hargaBeli: String(hargaBeli), totalModal: String(totalModal),
    }).where(eq(penjualanTable.id, id)).returning();

    if (!updated.length) return res.status(404).json({ error: "Not found" });
    return res.json(toDto(updated[0]));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/:id", async (req, res) => {
    const db = getDb();
    if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    const id = parseInt(req.params.id);
    
    // Check if there are any bank transactions associated with this sale
    const existingTx = await db.select().from(transaksiBank).where(eq(transaksiBank.penjualanId, id));
    if (existingTx.length > 0) {
      return res.status(400).json({ 
        error: "Transaksi sudah masuk di menu Pencairan Perbank. Silakan batalkan pencairan terlebih dahulu sebelum menghapus transaksi ini." 
      });
    }

    await db.delete(penjualanTable).where(eq(penjualanTable.id, id));
    return res.json({ success: true, message: "Deleted" });
  } catch (err) {
    console.error("Error deleting sale:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

function toDto(row: any) {
  return {
    id: row.id,
    tanggal: row.tanggal,
    nomor: row.nomor,
    kodeTransaksi: row.kodeTransaksi,
    noFaktur: row.noFaktur,
    kodeBarang: row.kodeBarang,
    namaBarang: row.namaBarang,
    brand: row.brand,
    harga: toNumber(row.harga),
    qty: row.qty,
    total: toNumber(row.total),
    paymentMethod: row.paymentMethod,
    nilaiCash: row.nilaiCash != null ? toNumber(row.nilaiCash) : null,
    namaBank: row.namaBank,
    nilaiBank: row.nilaiBank != null ? toNumber(row.nilaiBank) : null,
    namaOnlineShop: row.namaOnlineShop,
    nilaiOnlineShop: row.nilaiOnlineShop != null ? toNumber(row.nilaiOnlineShop) : null,
    namaCustomer: row.namaCustomer,
    nilaiKredit: row.nilaiKredit != null ? toNumber(row.nilaiKredit) : null,
    statusCair: row.statusCair,
    tanggalCair: row.tanggalCair,
    totalPaid: row.totalPaid || (row.statusCair === 'cair' ? toNumber(row.total) : 0),
    hargaBeli: row.hargaBeli != null ? toNumber(row.hargaBeli) : null,
    totalModal: row.totalModal != null ? toNumber(row.totalModal) : null,
  };
}

export default router;
