import fs from 'fs';
import { getDb, penjualanTable, masterBarangTable } from "./lib/db/src/index.ts";
import { eq, sql } from "drizzle-orm";
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const db = getDb();
  if (!db) {
    process.exit(1);
  }
  try {
     const barang = (await db.select().from(masterBarangTable).where(eq(masterBarangTable.kodeBarang, "P332202")))[0];
     
     const tanggal = '2026-03-27';
     const hargaNum = 10000;
     const qtyNum = 1;
     const total = 10000;
     const hargaBeli = parseFloat(barang.hargaBeli);
     const totalModal = hargaBeli * qtyNum;
     
     try {
       await db.insert(penjualanTable).values({
          tanggal,
          nomor: 0, // intentional for testing or just use a real one
          kodeTransaksi: 'TRX-TEST-' + Date.now(),
          kodeBarang: barang.kodeBarang,
          namaBarang: barang.namaBarang,
          brand: barang.brand,
          harga: String(hargaNum),
          qty: qtyNum,
          total: String(total),
          paymentMethod: 'cash',
          statusCair: 'cair',
          hargaBeli: String(hargaBeli),
          totalModal: String(totalModal),
       }).returning();
       fs.writeFileSync('./tmp_output.txt', "SUCCESS");
     } catch (err) {
       // LOG THE FULL ERROR OBJECT
       const fullErr = {
         message: err.message,
         code: err.code,
         detail: err.detail,
         hint: err.hint,
         constraint: err.constraint,
         table: err.table,
         column: err.column,
         dataType: err.dataType,
         stack: err.stack
       };
       fs.writeFileSync('./tmp_output.txt', JSON.stringify(fullErr, null, 2));
     }
  } catch (err) {
    fs.writeFileSync('./tmp_output.txt', "OUTER ERROR: " + err.message);
  }
  process.exit(0);
}
check();
