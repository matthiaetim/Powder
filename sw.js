// Service Worker: alles vorab cachen, offline starten. Cache-Name trägt die Version,
// damit ein Deploy beim nächsten Start ankommt. Version bumpen: tools/bump.sh <version>
const VERSION = '0.6.1';
const CACHE = 'powder-' + VERSION;
const FILES = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './src/constants.js',
  './src/physics.js',
  './src/world.js',
  './src/avalanche.js',
  './src/collision.js',
  './src/track.js',
  './src/particles.js',
  './src/storage.js',
  './src/modes.js',
  './src/tune.js',
  './src/input.js',
  './src/render.js',
  './src/hud.js',
  './src/game.js',
  './src/main.js',
  './fonts/PlayfairDisplay-Italic.woff2',
  './icons/icon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' umgeht den HTTP-Cache des Browsers, damit wirklich die neuen Dateien landen
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) =>
      hit || fetch(req).catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : undefined))
    )
  );
});
