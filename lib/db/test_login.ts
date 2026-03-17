const resp = await fetch('http://localhost:5000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'admin123' })
});

console.log('Status:', resp.status);
const data = await resp.json();
console.log('Data:', JSON.stringify(data, null, 2));

if (resp.status === 200 && data.success) {
  console.log('Login logic confirmed on backend.');
} else {
  console.log('Login failed on backend.');
}
