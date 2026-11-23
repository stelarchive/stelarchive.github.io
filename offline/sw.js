/* 오프라인 플레이어를 인터넷 없이도 열 수 있게, 페이지 파일을 저장해 두는 일꾼.
   이 폴더(/offline/) 안에서만 일한다 — 원래 사이트에는 손대지 않는다 */
const SHELL = 'stl-offline-shell-v4';
const FILES = ['./', './index.html', './icon.svg', './manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('stl-offline-shell-') && k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// 인터넷이 되면 새 파일을 받아 저장하고, 안 되면 저장해 둔 걸 준다
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) {
    // 글꼴: 받아 둔 게 있으면 그걸, 없으면 받아서 저장
    if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
      e.respondWith(caches.open(SHELL).then(async c => (await c.match(req)) || fetch(req).then(r => { c.put(req, r.clone()); return r; })));
    }
    return;
  }
  e.respondWith(fetch(req).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(SHELL).then(c => c.put(req, copy)); }
    return r;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))));
});
