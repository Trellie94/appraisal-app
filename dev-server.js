// Local stand-in for Vercel: serves public/ and runs the api/ functions with an in-memory database.
// Usage: npm run build && APP_PASSWORD=test node dev-server.js
process.env.MEMORY_DB = process.env.MEMORY_DB || '1';
const http = require('http'), fs = require('fs'), path = require('path');
const port = process.env.PORT || 3000;
http.createServer((req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  const m = /^\/api\/(login|logout|data)$/.exec(p);
  if (m) return require('./api/' + m[1] + '.js')(req, res);
  const file = path.join(__dirname, 'public', p === '/' ? 'index.html' : p);
  fs.readFile(file, (e, buf) => { if (e) { res.statusCode = 404; return res.end('Not found'); } res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(buf); });
}).listen(port, () => console.log('http://localhost:' + port));
