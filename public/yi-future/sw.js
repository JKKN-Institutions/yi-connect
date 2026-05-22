/* YiFuture service worker — vanilla JS */
/* Cache version — bump to invalidate old caches */
const CACHE_VERSION = "v2-yifuture";

/* ─── MESSAGE: SKIP_WAITING from UpdatePrompt ──────────────────────── */
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGES_CACHE = `${CACHE_VERSION}-pages`;
const IMAGES_CACHE = `${CACHE_VERSION}-images`;

const OFFLINE_URL = "/offline";

/* App shell — pre-cached on install. Single 404 won't fail install. */
const STATIC_ASSETS = [
  "/",
  OFFLINE_URL,
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

/* ─── INSTALL: pre-cache shell + offline fallback ──────────────────── */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        Promise.allSettled(STATIC_ASSETS.map((asset) => cache.add(asset)))
      )
      .then(() => self.skipWaiting())
  );
});

/* ─── ACTIVATE: prune old versions, claim clients ──────────────────── */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("v") && !k.startsWith(CACHE_VERSION))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ─── Helpers ──────────────────────────────────────────────────────── */
function isImageRequest(request, url) {
  if (request.destination === "image") return true;
  return /\.(png|jpg|jpeg|svg|gif|webp|ico)$/i.test(url.pathname);
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.json"
  );
}

function isHtmlNavigation(request) {
  if (request.mode === "navigate") return true;
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html");
}

/* Network with timeout — falls back to cache, then to /offline. */
function networkFirstWithTimeout(request, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      caches.match(request).then((cached) => {
        if (cached) return resolve(cached);
        caches.match(OFFLINE_URL).then((offline) => {
          resolve(offline || Response.error());
        });
      });
    }, timeoutMs);

    fetch(request)
      .then((response) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (response && response.status === 200 && response.type === "basic") {
          const clone = response.clone();
          caches.open(PAGES_CACHE).then((cache) => cache.put(request, clone));
        }
        resolve(response);
      })
      .catch(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        caches.match(request).then((cached) => {
          if (cached) return resolve(cached);
          caches.match(OFFLINE_URL).then((offline) => {
            resolve(offline || Response.error());
          });
        });
      });
  });
}

function cacheFirst(request, cacheName) {
  return caches.match(request).then((cached) => {
    if (cached) return cached;
    return fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const clone = response.clone();
          caches.open(cacheName).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => cached);
  });
}

/* ─── FETCH router ─────────────────────────────────────────────────── */
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  /* API routes: bypass — always network, never cache. */
  if (url.pathname.startsWith("/api/")) return;

  /* HTML navigations: network-first w/ 3s timeout → cache → /offline. */
  if (isHtmlNavigation(request)) {
    event.respondWith(networkFirstWithTimeout(request, 3000));
    return;
  }

  /* Static assets (Next bundles, icons, manifest): cache-first. */
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  /* Images: cache-first. */
  if (isImageRequest(request, url)) {
    event.respondWith(cacheFirst(request, IMAGES_CACHE));
    return;
  }

  /* Everything else: let the browser handle it. */
});

/* ─── PUSH: show notification ──────────────────────────────────────── */
self.addEventListener("push", (event) => {
  let payload = { title: "YiFuture", body: "You have a new update.", url: "/" };
  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      try {
        payload.body = event.data.text();
      } catch {
        /* ignore */
      }
    }
  }

  const options = {
    body: payload.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: payload.url || "/" },
    vibrate: [120, 60, 120],
    tag: payload.tag || "yifuture-notification",
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

/* ─── NOTIFICATION CLICK: focus/open the URL ───────────────────────── */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          try {
            const clientUrl = new URL(client.url);
            if (clientUrl.origin === self.location.origin && "focus" in client) {
              client.navigate(targetUrl).catch(() => {});
              return client.focus();
            }
          } catch {
            /* ignore */
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return null;
      })
  );
});
