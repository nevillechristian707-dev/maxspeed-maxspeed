import "dotenv/config";
import pg from "pg";

async function diag() {
  const client = new pg.Client({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  
  console.log("--- DATA USER SISKA ---");
  const userRes = await client.query("SELECT * FROM users WHERE username = 'siska'");
  console.log(JSON.stringify(userRes.rows, null, 2));

  if (userRes.rows.length > 0) {
    const roleName = userRes.rows[0].role;
    console.log("\n--- DATA ROLE: " + roleName + " ---");
    const roleRes = await client.query("SELECT * FROM roles WHERE name = $1", [roleName]);
    console.log(JSON.stringify(roleRes.rows, null, 2));
  }

  await client.end();
}

diag().catch(console.error);
