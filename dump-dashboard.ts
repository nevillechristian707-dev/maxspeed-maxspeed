import { db } from "./lib/db/src/index";
import { sql } from "drizzle-orm";

async function test() {
  const s = "2026-03-01";
  const e = "2026-03-31";
  
  const query = sql`
      WITH filtered_sales AS (
        SELECT 
          id, total, harga_beli, qty, payment_method, status_cair, tanggal, tanggal_cair
        FROM penjualan
        WHERE 
          (payment_method IN ('cash', 'bank') AND tanggal >= ${s} AND tanggal <= ${e})
          OR (payment_method IN ('online_shop', 'kredit') AND (
            (tanggal_cair >= ${s} AND tanggal_cair <= ${e})
            OR EXISTS (
              SELECT 1 FROM transaksi_bank tb 
              WHERE tb.penjualan_id = penjualan.id 
              AND tb.tanggal_cair >= ${s} AND tb.tanggal_cair <= ${e}
            )
          ))
      ),
      payment_stats AS (
        SELECT 
          id,
          CASE 
            WHEN payment_method IN ('cash', 'bank') THEN total::numeric
            ELSE (SELECT coalesce(sum(nilai::numeric), 0) FROM transaksi_bank WHERE penjualan_id = filtered_sales.id AND tanggal_cair >= ${s} AND tanggal_cair <= ${e})
          END as amount_in_period,
          harga_beli::numeric * qty as modal_total
        FROM filtered_sales
      )
      SELECT 
        coalesce(sum(amount_in_period), 0) as total_penjualan,
        (SELECT coalesce(sum(harga_beli::numeric * qty), 0) FROM filtered_sales 
         WHERE (payment_method IN ('cash', 'bank')) OR (payment_method IN ('online_shop', 'kredit') AND status_cair = 'cair' AND tanggal_cair >= ${s} AND tanggal_cair <= ${e})) as total_modal,
        count(distinct id) as total_transaksi,
        coalesce(sum(CASE WHEN payment_method = 'cash' THEN amount_in_period ELSE 0 END), 0) as cash_total,
        coalesce(sum(CASE WHEN payment_method = 'bank' THEN amount_in_period ELSE 0 END), 0) as bank_total,
        coalesce(sum(CASE WHEN payment_method = 'online_shop' THEN amount_in_period ELSE 0 END), 0) as os_total,
        coalesce(sum(CASE WHEN payment_method = 'kredit' THEN amount_in_period ELSE 0 END), 0) as kredit_total
      FROM filtered_sales
      LEFT JOIN payment_stats ON filtered_sales.id = payment_stats.id
  `;

  console.log("Testing Query...");
  try {
    const start = Date.now();
    const result = await db.execute(query);
    console.log("Result:", JSON.stringify(result.rows[0], null, 2));
    console.log("Time taken:", (Date.now() - start), "ms");
  } catch (err) {
    console.error("Error:", err);
  }
  process.exit(0);
}

test();
