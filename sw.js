/* Qur service worker — offline support.
 *
 * Strategy:
 *  - App shell (same-origin html/css/js): network-first, cache fallback,
 *    so code updates land immediately but the app still opens offline.
 *  - Quran content (API responses, bundled data/, fonts): cache-first —
 *    the texts are immutable, so once read a surah stays readable offline.
 *  - Search: network-only (results are dynamic and cheap).
 *  - Audio is left to the browser (files are large; not precached).
 */
const CACHE = "qur-v1";
const SHELL = ["./", "index.html", "style.css", "app.js"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

/* No clients.claim(): taking over a page mid-load aborts its in-flight
 * requests. The SW simply controls the next page load instead. */
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
});

const CONTENT_HOSTS = ["api.qurancdn.com", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.pathname.includes("/search")) return; // always live

  const sameOrigin = url.origin === location.origin;
  const isData = sameOrigin && url.pathname.includes("/data/");
  const isShell = sameOrigin && !isData;

  if (isShell) {
    e.respondWith(
      // no-cache: revalidate with the server so shell updates aren't masked
      // by the browser's heuristic HTTP cache.
      fetch(e.request, { cache: "no-cache" })
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  if (isData || CONTENT_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }))
    );
  }
});
