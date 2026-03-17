import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const { Pool } = pg;

let _pool: any = null;
let _db: any = null;

export const getDb = () => {
  if (_db) return _db;
  if (!process.env.DATABASE_URL) {
    return null;
  }
  _pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("pooler.supabase.com")
      ? { rejectUnauthorized: false }
      : undefined,
  });
  _db = drizzle(_pool, { schema });
  return _db;
};

export const db = getDb();

export * from "./schema";
