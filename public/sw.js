// SPDX-License-Identifier: MIT

// Service worker tối thiểu cho PWA: cache shell, network-first cho điều hướng.
// Không cache /api/ hay /snapshots/ (dữ liệu thời gian thực, luôn phải mới).
const CACHE_VERSION = 'safesight-shell-v1';
const SHELL_URLS = ['/manifest.webmanifest', '/icons/icon-192.png'];
// Trang offline khi mất mạng và cache cũng không có sẵn (thay vì phục vụ '/' đã cache,
// có thể là bản ghi đã redirect sang /login và làm hỏng điều hướng).
const OFFLINE_HTML = `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<title>Mất kết nối</title></head><body style="font-family:system-ui,sans-serif;text-align:center;padding:2.5rem">
<h1>Mất kết nối mạng</h1><p>Vui lòng kiểm tra kết nối và thử lại.</p></body></html>`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bỏ qua API và ảnh/clip snapshot: không bao giờ phục vụ từ cache.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/snapshots/')) {
    return;
  }

  // Chỉ can thiệp điều hướng trang (network-first, fallback cache khi mất mạng).
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Không cache redirect (vd. '/' -> '/login' khi chưa đăng nhập) hay lỗi:
          // phục vụ lại sau sẽ ném TypeError và làm trắng trang điều hướng.
          if (response.ok && !response.redirected) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || new Response(
          OFFLINE_HTML,
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        )))
    );
  }
});
