import { db, penjualanTable, masterBarangTable, masterOnlineShopTable, customerTable, masterBankTable } from "./index.js";
import { eq } from "drizzle-orm";

async function forceSeed() {
  console.log("🚀 Starting Full Sample Seeding...");

  try {
    // 1. Ensure Master Barang
    let products = await db.select().from(masterBarangTable);
    if (products.length < 3) {
      console.log("📦 Creating products...");
      await db.insert(masterBarangTable).values([
        { kodeBarang: "B001", namaBarang: "Velg Racing A1", brand: "MaxSpeed", supplier: "Global Part", hargaBeli: "800000", hargaJual: "1200000" },
        { kodeBarang: "B002", namaBarang: "Ban Sport B2", brand: "MaxSpeed", supplier: "Global Part", hargaBeli: "300000", hargaJual: "500000" },
        { kodeBarang: "B003", namaBarang: "Knalpot Carbon", brand: "MaxSpeed", supplier: "Elite Exhaust", hargaBeli: "1500000", hargaJual: "2500000" }
      ]).onConflictDoNothing();
      products = await db.select().from(masterBarangTable);
    }

    // 2. Ensure Online Shops
    let shops = await db.select().from(masterOnlineShopTable);
    if (shops.length < 2) {
      console.log("🛒 Creating shops...");
      await db.insert(masterOnlineShopTable).values([
        { namaOnlineShop: "TOKOPEDIA", keterangan: "Toko Utama" },
        { namaOnlineShop: "SHOPEE", keterangan: "Toko Cabang" }
      ]).onConflictDoNothing();
      shops = await db.select().from(masterOnlineShopTable);
    }

    // 3. Ensure Customers
    let customers = await db.select().from(customerTable);
    if (customers.length < 2) {
      console.log("👤 Creating customers...");
      await db.insert(customerTable).values([
        { namaCustomer: "Budi Santoso", keterangan: "Langganan" },
        { namaCustomer: "Ani Wijaya", keterangan: "Baru" }
      ]).onConflictDoNothing();
      customers = await db.select().from(customerTable);
    }

    // 4. Ensure Master Bank
    let banks = await db.select().from(masterBankTable);
    if (banks.length === 0) {
        console.log("🏦 Creating banks...");
        await db.insert(masterBankTable).values([
            { namaBank: "BCA", nomorRekening: "1234567890", keterangan: "Rekening Operasional" },
            { namaBank: "MANDIRI", nomorRekening: "0987654321", keterangan: "Rekening Tabungan" }
        ]);
    }

    console.log(`📊 Found ${products.length} products, ${shops.length} shops, ${customers.length} customers.`);

    console.log("📝 Seeding 10 sample penjualan records...");
    const samples = [];
    for (let i = 1; i <= 10; i++) {
        const p = products[i % products.length];
        const isOnline = i % 2 !== 0;
        const shop = shops[i % shops.length];
        const cust = customers[i % customers.length];

        samples.push({
          tanggal: `2026-03-${i.toString().padStart(2, '0')}`,
          nomor: 400 + i,
          kodeTransaksi: `TRX-2026-SMPL-${i}`,
          noFaktur: `FKT/2026/${i.toString().padStart(2, '0')}`,
          kodeBarang: p.kodeBarang,
          namaBarang: p.namaBarang,
          brand: p.brand,
          harga: p.hargaJual,
          qty: 1,
          total: p.hargaJual,
          paymentMethod: isOnline ? "online_shop" : "kredit",
          namaOnlineShop: isOnline ? shop.namaOnlineShop : null,
          nilaiOnlineShop: isOnline ? String(Number(p.hargaJual) * 0.98) : null,
          namaCustomer: !isOnline ? cust.namaCustomer : null,
          nilaiKredit: !isOnline ? p.hargaJual : null,
          statusCair: "pending",
          hargaBeli: p.hargaBeli,
          totalModal: p.hargaBeli
        });
    }

    for (const sample of samples) {
      const exists = await db.select().from(penjualanTable).where(eq(penjualanTable.kodeTransaksi, sample.kodeTransaksi));
      if (exists.length === 0) {
        await db.insert(penjualanTable).values(sample);
      }
    }

    console.log("✅ Full house seeding successful!");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
  }
}

forceSeed();
