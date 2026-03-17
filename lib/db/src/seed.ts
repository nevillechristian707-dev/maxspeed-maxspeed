import { db, usersTable, penjualanTable, masterBarangTable, masterOnlineShopTable, customerTable } from "./index";
import { eq } from "drizzle-orm";

async function seedSamples(): Promise<void> {
  console.log("🌱 Seeding 10 sample penjualan records for Pencairan...");

  try {
    const products = await db.select().from(masterBarangTable).limit(5);
    const shops = await db.select().from(masterOnlineShopTable).limit(2);
    const customers = await db.select().from(customerTable).limit(2);

    if (products.length === 0 || shops.length === 0 || customers.length === 0) {
      console.warn("⚠️  Skipping samples: Need master data (products, shops, customers) in database.");
      return;
    }

    const samples = [
        {
          tanggal: "2026-03-01",
          nomor: 201,
          kodeTransaksi: "TRX-20260301-SMPL1",
          noFaktur: "SMPL/2026/001",
          kodeBarang: products[0].kodeBarang,
          namaBarang: products[0].namaBarang,
          brand: products[0].brand,
          harga: products[0].hargaJual,
          qty: 1,
          total: products[0].hargaJual,
          paymentMethod: "online_shop",
          namaOnlineShop: shops[0].namaOnlineShop,
          nilaiOnlineShop: String(Number(products[0].hargaJual) * 0.975),
          statusCair: "pending",
          hargaBeli: products[0].hargaBeli,
          totalModal: products[0].hargaBeli
        },
        {
          tanggal: "2026-03-02",
          nomor: 202,
          kodeTransaksi: "TRX-20260302-SMPL2",
          noFaktur: "SMPL/2026/002",
          kodeBarang: products[1].kodeBarang,
          namaBarang: products[1].namaBarang,
          brand: products[1].brand,
          harga: products[1].hargaJual,
          qty: 2,
          total: String(Number(products[1].hargaJual) * 2),
          paymentMethod: "kredit",
          namaCustomer: customers[0].namaCustomer,
          nilaiKredit: String(Number(products[1].hargaJual) * 2),
          statusCair: "pending",
          hargaBeli: products[1].hargaBeli,
          totalModal: String(Number(products[1].hargaBeli) * 2)
        },
        {
          tanggal: "2026-03-03",
          nomor: 203,
          kodeTransaksi: "TRX-20260303-SMPL3",
          noFaktur: "SMPL/2026/003",
          kodeBarang: products[2].kodeBarang,
          namaBarang: products[2].namaBarang,
          brand: products[2].brand,
          harga: products[2].hargaJual,
          qty: 1,
          total: products[2].hargaJual,
          paymentMethod: "online_shop",
          namaOnlineShop: shops[1].namaOnlineShop,
          nilaiOnlineShop: String(Number(products[2].hargaJual) * 0.98),
          statusCair: "pending",
          hargaBeli: products[2].hargaBeli,
          totalModal: products[2].hargaBeli
        },
        {
          tanggal: "2026-03-04",
          nomor: 204,
          kodeTransaksi: "TRX-20260304-SMPL4",
          noFaktur: "SMPL/2026/004",
          kodeBarang: products[0].kodeBarang,
          namaBarang: products[0].namaBarang,
          brand: products[0].brand,
          harga: products[0].hargaJual,
          qty: 1,
          total: products[0].hargaJual,
          paymentMethod: "kredit",
          namaCustomer: customers[1].namaCustomer,
          nilaiKredit: products[0].hargaJual,
          statusCair: "pending",
          hargaBeli: products[0].hargaBeli,
          totalModal: products[0].hargaBeli
        },
        {
          tanggal: "2026-03-05",
          nomor: 205,
          kodeTransaksi: "TRX-20260305-SMPL5",
          noFaktur: "SMPL/2026/005",
          kodeBarang: products[3].kodeBarang,
          namaBarang: products[3].namaBarang,
          brand: products[3].brand,
          harga: products[3].hargaJual,
          qty: 1,
          total: products[3].hargaJual,
          paymentMethod: "online_shop",
          namaOnlineShop: shops[0].namaOnlineShop,
          nilaiOnlineShop: String(Number(products[3].hargaJual) * 0.975),
          statusCair: "pending",
          hargaBeli: products[3].hargaBeli,
          totalModal: products[3].hargaBeli
        },
        {
          tanggal: "2026-03-06",
          nomor: 206,
          kodeTransaksi: "TRX-20260306-SMPL6",
          noFaktur: "SMPL/2026/006",
          kodeBarang: products[4].kodeBarang,
          namaBarang: products[4].namaBarang,
          brand: products[4].brand,
          harga: products[4].hargaJual,
          qty: 10,
          total: String(Number(products[4].hargaJual) * 10),
          paymentMethod: "kredit",
          namaCustomer: customers[0].namaCustomer,
          nilaiKredit: String(Number(products[4].hargaJual) * 10),
          statusCair: "pending",
          hargaBeli: products[4].hargaBeli,
          totalModal: String(Number(products[4].hargaBeli) * 10)
        },
        {
          tanggal: "2026-03-07",
          nomor: 207,
          kodeTransaksi: "TRX-20260307-SMPL7",
          noFaktur: "SMPL/2026/007",
          kodeBarang: products[1].kodeBarang,
          namaBarang: products[1].namaBarang,
          brand: products[1].brand,
          harga: products[1].hargaJual,
          qty: 1,
          total: products[1].hargaJual,
          paymentMethod: "online_shop",
          namaOnlineShop: shops[1].namaOnlineShop,
          nilaiOnlineShop: String(Number(products[1].hargaJual) * 0.98),
          statusCair: "pending",
          hargaBeli: products[1].hargaBeli,
          totalModal: products[1].hargaBeli
        },
        {
          tanggal: "2026-03-08",
          nomor: 208,
          kodeTransaksi: "TRX-20260308-SMPL8",
          noFaktur: "SMPL/2026/008",
          kodeBarang: products[2].kodeBarang,
          namaBarang: products[2].namaBarang,
          brand: products[2].brand,
          harga: products[2].hargaJual,
          qty: 2,
          total: String(Number(products[2].hargaJual) * 2),
          paymentMethod: "kredit",
          namaCustomer: customers[1].namaCustomer,
          nilaiKredit: String(Number(products[2].hargaJual) * 2),
          statusCair: "pending",
          hargaBeli: products[2].hargaBeli,
          totalModal: String(Number(products[2].hargaBeli) * 2)
        },
        {
          tanggal: "2026-03-09",
          nomor: 209,
          kodeTransaksi: "TRX-20260309-SMPL9",
          noFaktur: "SMPL/2026/009",
          kodeBarang: products[3].kodeBarang,
          namaBarang: products[3].namaBarang,
          brand: products[3].brand,
          harga: products[3].hargaJual,
          qty: 1,
          total: products[3].hargaJual,
          paymentMethod: "online_shop",
          namaOnlineShop: shops[0].namaOnlineShop,
          nilaiOnlineShop: String(Number(products[3].hargaJual) * 0.975),
          statusCair: "pending",
          hargaBeli: products[3].hargaBeli,
          totalModal: products[3].hargaBeli
        },
        {
          tanggal: "2026-03-10",
          nomor: 210,
          kodeTransaksi: "TRX-20260310-SMPL10",
          noFaktur: "SMPL/2026/010",
          kodeBarang: products[4].kodeBarang,
          namaBarang: products[4].namaBarang,
          brand: products[4].brand,
          harga: products[4].hargaJual,
          qty: 5,
          total: String(Number(products[4].hargaJual) * 5),
          paymentMethod: "kredit",
          namaCustomer: customers[0].namaCustomer,
          nilaiKredit: String(Number(products[4].hargaJual) * 5),
          statusCair: "pending",
          hargaBeli: products[4].hargaBeli,
          totalModal: String(Number(products[4].hargaBeli) * 5)
        }
      ];

    for (const sample of samples) {
      // Avoid duplicates
      const exists = await db.select().from(penjualanTable).where(eq(penjualanTable.kodeTransaksi, sample.kodeTransaksi));
      if (exists.length === 0) {
        await db.insert(penjualanTable).values(sample);
      }
    }

    console.log("✅ Successfully seeded 10 samples!");
  } catch (error) {
    console.error("❌ Seed samples failed:", error);
  }
}

async function seed(): Promise<void> {
  console.log("Seeding database...");

  // Check if admin exists
  const existingAdmin = await db.select().from(usersTable).where(eq(usersTable.username, "admin"));

  if (existingAdmin.length === 0) {
    console.log("Creating admin user...");
    await db.insert(usersTable).values({
      username: "admin",
      password: "admin123",
      name: "Administrator",
      role: "admin",
    });
    console.log("Admin user created.");
  } else {
    console.log("Admin user already exists.");
  }

  await seedSamples();

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
