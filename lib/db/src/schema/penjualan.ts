import { pgTable, serial, text, numeric, integer, timestamp, date, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const penjualanTable = pgTable("penjualan", {
  id: serial("id").primaryKey(),
  tanggal: date("tanggal").notNull(),
  nomor: integer("nomor").notNull(),
  kodeTransaksi: text("kode_transaksi").notNull().unique(),
  noFaktur: text("no_faktur"),
  kodeBarang: text("kode_barang").notNull(),
  namaBarang: text("nama_barang").notNull(),
  brand: text("brand").notNull(),
  harga: numeric("harga", { precision: 15, scale: 2 }).notNull(),
  qty: integer("qty").notNull(),
  total: numeric("total", { precision: 15, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull(),
  nilaiCash: numeric("nilai_cash", { precision: 15, scale: 2 }),
  namaBank: text("nama_bank"),
  nilaiBank: numeric("nilai_bank", { precision: 15, scale: 2 }),
  namaOnlineShop: text("nama_online_shop"),
  nilaiOnlineShop: numeric("nilai_online_shop", { precision: 15, scale: 2 }),
  namaCustomer: text("nama_customer"),
  nilaiKredit: numeric("nilai_kredit", { precision: 15, scale: 2 }),
  statusCair: text("status_cair").default("pending"),
  tanggalCair: date("tanggal_cair"),
  hargaBeli: numeric("harga_beli", { precision: 15, scale: 2 }),
  totalModal: numeric("total_modal", { precision: 15, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return [
    index("idx_penjualan_tanggal").on(table.tanggal),
    index("idx_penjualan_status_cair").on(table.statusCair),
    index("idx_penjualan_payment_method").on(table.paymentMethod),
    index("idx_penjualan_tanggal_cair").on(table.tanggalCair),
    index("idx_penjualan_kode_barang").on(table.kodeBarang),
  ];
});

export const insertPenjualanSchema = createInsertSchema(penjualanTable).omit({ id: true, createdAt: true });
export type InsertPenjualan = z.infer<typeof insertPenjualanSchema>;
export type Penjualan = typeof penjualanTable.$inferSelect;
