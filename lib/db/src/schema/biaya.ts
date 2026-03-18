import { pgTable, serial, text, numeric, timestamp, date, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const biayaTable = pgTable("biaya", {
  id: serial("id").primaryKey(),
  tanggal: date("tanggal").notNull(),
  keterangan: text("keterangan").notNull(),
  nilai: numeric("nilai", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return [
    index("idx_biaya_tanggal").on(table.tanggal),
  ];
});

export const insertBiayaSchema = createInsertSchema(biayaTable).omit({ id: true, createdAt: true });
export type InsertBiaya = z.infer<typeof insertBiayaSchema>;
export type Biaya = typeof biayaTable.$inferSelect;
