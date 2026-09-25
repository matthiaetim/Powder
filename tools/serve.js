// Winziger statischer Dev-Server ohne Abhängigkeiten, Caching aus.
// Start: node tools/serve.js [port] [--board]   → http://localhost:8080
// --board: Mock der Bestenlisten-Schnittstelle (tools/board-mock.js), im Browser mit ?board=local ansprechen.
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const root = path.resolve(__dirname, '..');
const port = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) || 8080);
const board = process.argv.includes('--board') ? require('./board-mock.js') : null;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

http.createServer((req, res) => {
  if (board && board.handle(req, res)) return;
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(root, p));
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(port, '0.0.0.0', () => {
  const lan = Object.values(os.networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal);
  console.log(`Powder läuft auf http://localhost:${port}` + (lan ? `  (iPhone im WLAN: http://${lan.address}:${port})` : ''));
});
