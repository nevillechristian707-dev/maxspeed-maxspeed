import { getDb, biayaTable } from "./lib/db/src/index";

async function check() {
  const db = getDb();
  if (!db) {
    console.log("No DB");
    return;
  }
  const all = await db.select().from(biayaTable);
  all.forEach(r => {
    console.log(`ID: ${r.id}, Tanggal: ${r.tanggal} (type: ${typeof r.tanggal}), Keterangan: ${r.keterangan}, Nilai: ${r.nilai}`);
  });
}

check();
