import { getDb } from "./index";
import { sql } from "drizzle-orm";
import dotenv from "dotenv";
import path from "path";

// Load .env from project root
dotenv.config({ path: path.resolve("../../.env") });

async function optimize() {
    const db = getDb();
    if (!db) {
        process.exit(1);
    }

    console.log("Optimizing database performance with indexes...");

    try {
        const indexes = [
            `CREATE INDEX IF NOT EXISTS idx_penjualan_tanggal ON penjualan(tanggal);`,
            `CREATE INDEX IF NOT EXISTS idx_penjualan_status_cair ON penjualan(status_cair);`,
            `CREATE INDEX IF NOT EXISTS idx_penjualan_payment_method ON penjualan(payment_method);`,
            `CREATE INDEX IF NOT EXISTS idx_penjualan_tanggal_cair ON penjualan(tanggal_cair);`,
            `CREATE INDEX IF NOT EXISTS idx_penjualan_kode_barang ON penjualan(kode_barang);`,
            `CREATE INDEX IF NOT EXISTS idx_biaya_tanggal ON biaya(tanggal);`,
            `CREATE INDEX IF NOT EXISTS idx_transaksi_bank_tanggal_cair ON transaksi_bank(tanggal_cair);`
        ];

        for (const query of indexes) {
            console.log(`Executing: ${query}`);
            await db.execute(sql.raw(query));
        }

        console.log("Optimization complete!");
        process.exit(0);
    } catch (err) {
        console.error("Optimization failed:", err);
        process.exit(1);
    }
}

optimize();
