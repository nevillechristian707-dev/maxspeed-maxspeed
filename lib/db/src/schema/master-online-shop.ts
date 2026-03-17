import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const masterOnlineShopTable = pgTable("master_online_shop", {
  id: serial("id").primaryKey(),
  namaOnlineShop: text("nama_online_shop").notNull(),
  keterangan: text("keterangan"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMasterOnlineShopSchema = createInsertSchema(masterOnlineShopTable).omit({ id: true, createdAt: true });
export type InsertMasterOnlineShop = z.infer<typeof insertMasterOnlineShopSchema>;
export type MasterOnlineShop = typeof masterOnlineShopTable.$inferSelect;
