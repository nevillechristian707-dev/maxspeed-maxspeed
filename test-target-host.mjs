import net from 'net';

const h = 'aws-1-ap-southeast-1.pooler.supabase.com';
const p = 6543;

console.log(`Testing ${h}:${p}...`);
const socket = new net.Socket();
socket.setTimeout(5000);
socket.on('connect', () => {
  console.log(`✅ ${h}:${p} is REACHABLE`);
  socket.destroy();
  process.exit(0);
});
socket.on('timeout', () => {
  console.log(`❌ ${h}:${p} TIMEOUT`);
  socket.destroy();
  process.exit(1);
});
socket.on('error', (err) => {
  console.log(`❌ ${h}:${p} ERROR: ${err.message}`);
  socket.destroy();
  process.exit(1);
});
socket.connect(p, h);
