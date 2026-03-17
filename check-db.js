require('dotenv').config();
const { Pool } = require('pg');

async function check() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("pooler.supabase.com") ? { rejectUnauthorized: false } : undefined,
  });

  try {
    const usersRes = await pool.query('SELECT * FROM users');
    console.log('=== USERS ===');
    console.table(usersRes.rows.map(u => ({ id: u.id, username: u.username, role: u.role, name: u.name })));

    const rolesRes = await pool.query('SELECT * FROM roles');
    console.log('\n=== ROLES ===');
    rolesRes.rows.forEach(r => {
      console.log(`\nRole: ${r.name}`);
      console.log('Permissions:', JSON.stringify(r.permissions, null, 2));
    });
    
    // Check siska specifically
    console.log('\n=== JOIN CHECK FOR SISKA ===');
    const siskaJoinRes = await pool.query(`
      SELECT 
        u.username, 
        u.role as user_role, 
        r.name as role_name, 
        r.permissions 
      FROM users u 
      LEFT JOIN roles r ON LOWER(u.role) = LOWER(r.name) 
      WHERE LOWER(u.username) = 'siska'
    `);
    console.log(JSON.stringify(siskaJoinRes.rows, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
