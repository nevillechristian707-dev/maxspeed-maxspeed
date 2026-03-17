import { pgTable, serial, varchar, date, numeric, integer, index } from "drizzle-orm/pg-core";

export const transaksiBank = pgTable("transaksi_bank", {
  id: serial("id").primaryKey(),
  tanggalCair: date("tanggal_cair").notNull(),
  noFaktur: varchar("no_faktur", { length: 255 }),
  nilai: numeric("nilai", { precision: 20, scale: 2 }).notNull(),
  sumber: varchar("sumber", { length: 255 }).notNull(), // online_shop or kredit
  namaBank: varchar("nama_bank", { length: 100 }).notNull(),
  rekeningBank: varchar("rekening_bank", { length: 100 }).notNull(),
  penjualanId: integer("penjualan_id").notNull(),
}, (table) => {
  return [
    index("idx_transaksi_bank_penjualan_id").on(table.penjualanId),
  ];
});
