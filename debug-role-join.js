const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres.xexofmouhxolapvnnuls:mlNLtel4F0MW8XJw@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=no-verify',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  
  const users = await client.query("SELECT username, role, LENGTH(role) as len FROM users");
  console.log("=== USERS ===");
  users.rows.forEach(u => {
    console.log(`User: [${u.username}], Role: [${u.role}], Length: ${u.len}`);
  });

  const roles = await client.query("SELECT name, LENGTH(name) as len FROM roles");
  console.log("\n=== ROLES ===");
  roles.rows.forEach(r => {
    console.log(`Role: [${r.name}], Length: ${r.len}`);
  });

  const joinTest = await client.query(`
    SELECT u.username, u.role, r.name as matched_role
    FROM users u
    LEFT JOIN roles r ON LOWER(u.role) = LOWER(r.name)
  `);
  console.log("\n=== JOIN TEST (LOWER(role) = LOWER(name)) ===");
  console.table(joinTest.rows);

  await client.end();
}

run().catch(console.error);
