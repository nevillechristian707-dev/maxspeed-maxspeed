import { pgTable, serial, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const masterBarangTable = pgTable("master_barang", {
  id: serial("id").primaryKey(),
  kodeBarang: text("kode_barang").notNull().unique(),
  namaBarang: text("nama_barang").notNull(),
  brand: text("brand").notNull(),
  supplier: text("supplier").notNull(),
  hargaBeli: numeric("harga_beli", { precision: 15, scale: 2 }).notNull(),
  hargaJual: numeric("harga_jual", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMasterBarangSchema = createInsertSchema(masterBarangTable).omit({ id: true, createdAt: true });
export type InsertMasterBarang = z.infer<typeof insertMasterBarangSchema>;
export type MasterBarang = typeof masterBarangTable.$inferSelect;
