const http = require('http');
http.get('http://localhost:3000/api/gates', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => { console.log('Status:', res.statusCode); console.log('Body:', data.substring(0, 100)); });
}).on('error', (err) => {
  console.error('Error:', err.message);
});
