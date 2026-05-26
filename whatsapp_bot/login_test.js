const fetch = require('node-fetch');
(async () => {
  const res = await fetch('http://localhost:3000/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Autommensor@2026' })
  });
  console.log('Status:', res.status);
  const txt = await res.text();
  console.log('Body:', txt);
  const cookies = res.headers.get('set-cookie');
  console.log('Set-Cookie:', cookies);
})();
