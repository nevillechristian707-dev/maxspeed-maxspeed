const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres.xexofmouhxolapvnnuls:mlNLtel4F0MW8XJw@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=no-verify',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const users = await client.query("SELECT id, username, role FROM users");
  console.log("USERS:");
  console.table(users.rows);
  
  const roles = await client.query("SELECT id, name, permissions FROM roles");
  console.log("\nROLES:");
  roles.rows.forEach(r => {
    console.log(`Role: [${r.name}]`);
    console.log(`Permissions:`, JSON.stringify(r.permissions, null, 2));
  });

  const siskaJoin = await client.query(`
    SELECT u.username, u.role, r.name as role_name, r.permissions
    FROM users u
    LEFT JOIN roles r ON LOWER(TRIM(u.role)) = LOWER(TRIM(r.name))
    WHERE u.username = 'siska'
  `);
  console.log("\nSISKA JOIN (with trim):");
  console.log(JSON.stringify(siskaJoin.rows, null, 2));

  await client.end();
}

run().catch(console.error);
