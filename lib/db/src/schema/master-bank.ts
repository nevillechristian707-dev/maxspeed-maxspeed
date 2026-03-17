import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const masterBankTable = pgTable("master_bank", {
  id: serial("id").primaryKey(),
  namaBank: text("nama_bank").notNull(),
  nomorRekening: text("nomor_rekening").notNull(),
  keterangan: text("keterangan"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMasterBankSchema = createInsertSchema(masterBankTable).omit({ id: true, createdAt: true });
export type InsertMasterBank = z.infer<typeof insertMasterBankSchema>;
export type MasterBank = typeof masterBankTable.$inferSelect;
