import { Router, type IRouter } from "express";
import { getDb, penjualanTable, masterBarangTable } from "../../../../lib/db/src/index";
import { eq, gte, lte, and, sql, desc } from "drizzle-orm";

const router: IRouter = Router();

function toNumber(val: unknown): number {
  return parseFloat(String(val ?? "0")) || 0;
}

router.get("/", async (req, res) => {
    const db = getDb();
    if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    const { startDate, endDate, paymentMethod } = req.query;
    const conditions = [];
    if (startDate) conditions.push(gte(penjualanTable.tanggal, String(startDate)));
    if (endDate) conditions.push(lte(penjualanTable.tanggal, String(endDate)));
    if (paymentMethod) conditions.push(eq(penjualanTable.paymentMethod, String(paymentMethod)));
    const rows = await db.select().from(penjualanTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(penjualanTable.tanggal), desc(penjualanTable.nomor));
    return res.json(rows.map(toDto));
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

    const countResult = await db.select({ cnt: sql<number>`count(*)` })
      .from(penjualanTable)
      .where(eq(penjualanTable.tanggal, tanggal));
    const dayCount = Number(countResult[0]?.cnt || 0) + 1;
    const dateStr = tanggal.replace(/-/g, "");
    const nomor = dayCount;
    const kodeTransaksi = `TRX-${dateStr}-${String(dayCount).padStart(3, "0")}`;

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
      nilaiCash: nilaiCash != null ? String(nilaiCash) : null,
      namaBank: namaBank || null,
      nilaiBank: nilaiBank != null ? String(nilaiBank) : null,
      namaOnlineShop: namaOnlineShop || null,
      nilaiOnlineShop: nilaiOnlineShop != null ? String(nilaiOnlineShop) : String(total),
      namaCustomer: namaCustomer || null,
      nilaiKredit: nilaiKredit != null ? String(nilaiKredit) : String(total),
      statusCair: needsCair ? "pending" : "cair",
      tanggalCair: null,
      hargaBeli: String(hargaBeli),
      totalModal: String(totalModal),
    }).returning();

    return res.status(201).json(toDto(inserted[0]));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
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
    await db.delete(penjualanTable).where(eq(penjualanTable.id, parseInt(req.params.id)));
    return res.json({ success: true, message: "Deleted" });
  } catch (err) {
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
    hargaBeli: row.hargaBeli != null ? toNumber(row.hargaBeli) : null,
    totalModal: row.totalModal != null ? toNumber(row.totalModal) : null,
  };
}

export default router;
