import { Router, type IRouter } from "express";
import { getDb, masterBarangTable } from "../../../../lib/db/src/index";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

function toDto(r: any) {
  return {
    id: r.id,
    kodeBarang: r.kodeBarang,
    namaBarang: r.namaBarang,
    brand: r.brand,
    supplier: r.supplier,
    hargaBeli: parseFloat(String(r.hargaBeli)),
    hargaJual: parseFloat(String(r.hargaJual)),
  };
}

router.get("/", async (_req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    const rows = await db.select().from(masterBarangTable).orderBy(masterBarangTable.namaBarang);
    return res.json(rows.map(toDto));
  } catch (err) {
    console.error("Error fetching master barang:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", async (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    const { kodeBarang, namaBarang, brand, supplier, hargaBeli, hargaJual } = req.body;
    const inserted = await db.insert(masterBarangTable).values({
      kodeBarang, 
      namaBarang, 
      brand, 
      supplier: supplier || "-",
      hargaBeli: String(hargaBeli), 
      hargaJual: String(hargaJual),
    }).returning();
    return res.status(201).json(toDto(inserted[0]));
  } catch (err) {
    console.error("Error creating master barang:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/bulk", async (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    const items: any[] = req.body.items;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "items array is required" });
    }

    const results = { inserted: 0, updated: 0, errors: [] as string[] };

    const parseNumeric = (val: any): string => {
      if (val === undefined || val === null || val === "") return "0";
      const s = String(val).trim();
      if (!s) return "0";
      
      if (/^-?\d+(\.\d+)?$/.test(s)) return s;

      const lastDot = s.lastIndexOf('.');
      const lastComma = s.lastIndexOf(',');
      const lastIdx = Math.max(lastDot, lastComma);
      
      if (lastIdx === -1) {
        const clean = s.replace(/[^\d-]/g, '');
        return clean || "0";
      }
      
      const suffix = s.substring(lastIdx + 1);
      if (suffix.length === 3) {
        const clean = s.replace(/[^\d-]/g, '');
        return clean || "0";
      } else {
        const integerPart = s.substring(0, lastIdx).replace(/[^\d-]/g, '');
        const decimalPart = suffix.replace(/[^\d]/g, '');
        return `${integerPart || '0'}.${decimalPart}`;
      }
    };

    await db.transaction(async (tx: any) => {
      for (const item of items) {
        const { kodeBarang, namaBarang, brand, supplier, hargaBeli, hargaJual } = item;
        
        if (!kodeBarang || !namaBarang) {
          results.errors.push(`Baris dilewati: Kode atau Nama kosong`);
          continue;
        }

        const hBeli = parseNumeric(hargaBeli);
        const hJual = parseNumeric(hargaJual);
        const kBarang = String(kodeBarang).trim();

        try {
          const existing = await tx.select().from(masterBarangTable)
            .where(eq(masterBarangTable.kodeBarang, kBarang));
          
          const payload = {
            namaBarang: String(namaBarang).trim(),
            brand: String(brand || "-").trim(),
            supplier: String(supplier || "-").trim(),
            hargaBeli: hBeli,
            hargaJual: hJual,
          };

          if (existing.length > 0) {
            await tx.update(masterBarangTable).set(payload)
              .where(eq(masterBarangTable.kodeBarang, kBarang));
            results.updated++;
          } else {
            await tx.insert(masterBarangTable).values({
              kodeBarang: kBarang,
              ...payload
            });
            results.inserted++;
          }
        } catch (e: any) {
          console.error(`Error importing row ${kBarang}:`, e);
          results.errors.push(`${kBarang}: ${e.message}`);
        }
      }
    });

    return res.json({ success: true, ...results });
  } catch (err) {
    console.error("Bulk import error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/:id", async (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    const { kodeBarang, namaBarang, brand, supplier, hargaBeli, hargaJual } = req.body;
    const updated = await db.update(masterBarangTable).set({
      kodeBarang, 
      namaBarang, 
      brand, 
      supplier: supplier || "-",
      hargaBeli: String(hargaBeli), 
      hargaJual: String(hargaJual),
    }).where(eq(masterBarangTable.id, parseInt(req.params.id))).returning();
    if (!updated.length) return res.status(404).json({ error: "Not found" });
    return res.json(toDto(updated[0]));
  } catch (err) {
    console.error("Error updating master barang:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/all", async (_req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    await db.delete(masterBarangTable);
    return res.json({ success: true, message: "Semua data barang telah dihapus" });
  } catch (err) {
    console.error("Bulk delete error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/:id", async (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database not initialized" });
  try {
    await db.delete(masterBarangTable).where(eq(masterBarangTable.id, parseInt(req.params.id)));
    return res.json({ success: true, message: "Deleted" });
  } catch (err) {
    console.error("Error deleting master barang:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
