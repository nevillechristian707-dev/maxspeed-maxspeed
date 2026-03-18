const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load .env from root
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const url = process.env.DATABASE_URL;
if (!url) {
    console.error("DATABASE_URL not found!");
    process.exit(1);
}

const pool = new Pool({
    connectionString: url,
    ssl: url.includes('pooler.supabase.com') ? { rejectUnauthorized: false } : undefined
});

async function run() {
    console.log("Starting DB optimization (Indexes)...");
    const client = await pool.connect();
    try {
         const queries = [
            `CREATE INDEX IF NOT EXISTS idx_penjualan_tanggal ON penjualan(tanggal);`,
            `CREATE INDEX IF NOT EXISTS idx_penjualan_status_cair ON penjualan(status_cair);`,
            `CREATE INDEX IF NOT EXISTS idx_penjualan_payment_method ON penjualan(payment_method);`,
            `CREATE INDEX IF NOT EXISTS idx_penjualan_tanggal_cair ON penjualan(tanggal_cair);`,
            `CREATE INDEX IF NOT EXISTS idx_penjualan_kode_barang ON penjualan(kode_barang);`,
            `CREATE INDEX IF NOT EXISTS idx_biaya_tanggal ON biaya(tanggal);`,
            `CREATE INDEX IF NOT EXISTS idx_transaksi_bank_tanggal_cair ON transaksi_bank(tanggal_cair);`
        ];

        for (const sql of queries) {
            console.log(`Executing: ${sql}`);
            await client.query(sql);
        }
        console.log("Optimization done!");
    } catch (err) {
        console.error("Failed:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
