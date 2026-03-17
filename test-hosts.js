import net from 'net';

const hosts = [
  { h: 'db.xexofmouhxolapvnnuls.supabase.co', p: 5432 },
  { h: 'aws-0-ap-southeast-1.pooler.supabase.com', p: 6543 },
  { h: 'aws-0-ap-southeast-1.pooler.supabase.com', p: 5432 },
  { h: 'xexofmouhxolapvnnuls.supabase.co', p: 5432 },
  { h: 'xexofmouhxolapvnnuls.supabase.co', p: 15432 },
  { h: 'xexofmouhxolapvnnuls.supabase.co', p: 6543 },
  { h: 'db.xexofmouhxolapvnnuls.supabase.com', p: 5432 }
];

async function testHost({ h, p }) {
  return new Promise((resolve) => {
    console.log(`Testing ${h}:${p}...`);
    const socket = new net.Socket();
    socket.setTimeout(3000);
    socket.on('connect', () => {
      console.log(`✅ ${h}:${p} is REACHABLE`);
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      console.log(`❌ ${h}:${p} TIMEOUT`);
      socket.destroy();
      resolve(false);
    });
    socket.on('error', (err) => {
      console.log(`❌ ${h}:${p} ERROR: ${err.message}`);
      socket.destroy();
      resolve(false);
    });
    socket.connect(p, h);
  });
}

(async () => {
  for (const host of hosts) {
    await testHost(host);
  }
})();
