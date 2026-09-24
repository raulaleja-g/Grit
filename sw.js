// Grit – service worker: guarda la app para que abra rápido y sin conexión.
// Sube VERSION cuando cambies archivos para forzar la actualización.
const VERSION = "grit-v1";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icons/logo.jpg",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "icons/favicon-32.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return; // los datos van directo a Google
  if (req.mode === "navigate" || url.pathname.endsWith(".html")) {
    // Red primero para recibir cambios; si no hay conexión, la copia guardada.
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res;
    }).catch(() => caches.match(req).then(r => r || caches.match("index.html"))));
    return;
  }
  e.respondWith(caches.match(req).then(r => r || fetch(req)));
});
