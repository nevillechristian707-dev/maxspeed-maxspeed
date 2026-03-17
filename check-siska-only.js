const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres.xexofmouhxolapvnnuls:mlNLtel4F0MW8XJw@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=no-verify',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  
  const siska = await client.query("SELECT * FROM users WHERE username = 'siska'");
  console.log("SISKA USER:");
  console.log(JSON.stringify(siska.rows, null, 2));

  const joinResult = await client.query(`
    SELECT u.username, u.role, r.name as role_name, r.permissions
    FROM users u
    LEFT JOIN roles r ON LOWER(TRIM(u.role)) = LOWER(TRIM(r.name))
    WHERE u.username = 'siska'
  `);
  console.log("\nJOIN RESULT:");
  console.log(JSON.stringify(joinResult.rows, null, 2));

  await client.end();
}

run().catch(console.error);
