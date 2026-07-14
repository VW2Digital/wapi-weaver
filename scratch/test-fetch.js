const http = require('http');

http.get('http://localhost:8080/', (res) => {
  console.log('STATUS:', res.statusCode);
  console.log('HEADERS:', JSON.stringify(res.headers, null, 2));
  
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('BODY LENGTH:', body.length);
    console.log('BODY PREVIEW:', body.substring(0, 1000));
  });
}).on('error', (e) => {
  console.error('ERROR:', e.message);
});
