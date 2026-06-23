/* eslint-disable no-undef */
/**
 * Yi Connect root service worker — RUNTIME caching only (v3, 2026-06-04).
 *
 * Replaces the stale build-time precache worker committed from an old Windows
 * webpack build: its ~275 precache entries (old chunk hashes, backslash icon
 * paths) 404 on every current deployment, so `install` failed forever and the
 * worker never activated — zero offline capability. Next 16 builds with
 * Turbopack, where @serwist/next's webpack injection never runs, so THIS
 * committed file is exactly what production serves. Keep it dependency-free.
 *
 * Strategy:
 *   • install   — instant (nothing to download), skipWaiting.
 *   • activate  — claim clients, drop the broken old caches, then SELF-PRIME:
 *                 cache the page each open tab is on right now, so even a
 *                 first visit becomes offline-reloadable immediately.
 *   • fetch     — GET-only, same-origin only, never /api/:
 *       page documents       → network-first (5s timeout), cache fallback
 *       /_next/static, fonts → cache-first (immutable hashed assets)
 *       other GETs (RSC …)   → network-first, cache fallback
 *
 * Built for one job above all: a juror who opened /yip/jury once can reload it
 * with the venue internet fully off; the in-page offline score buffer
 * (lib/yip/score-buffer.ts) takes over from there.
 */

const VERSION = "yc-v7-runtime-20260624";
const PAGES = `${VERSION}-pages`;
const STATIC = `${VERSION}-static`;
const ASSETS = `${VERSION}-assets`;
const OWN_CACHES = [PAGES, STATIC, ASSETS];

// ── Live-only routes: NEVER cache, NEVER serve a cached copy ──────────────
//
// A few organiser/projector routes are driven by Supabase realtime and MUST
// always reflect the live agenda + vote state. If the service worker ever
// serves a cached copy (e.g. the 5s network-first timeout fires on slow venue
// wifi, or a previously-cached page is replayed), the organiser sees the WRONG
// current agenda item / vote controls — a Day-2 bill vote instead of the live
// Day-1 Speaker Election, etc. (confirmed live 2026-06-15). These pages have no
// offline value anyway: with no network there is no live event to control.
//
// Scope is intentionally narrow — ONLY these live organiser/projector routes.
// The student dashboard (/yip/me/*) and jury (/yip/jury/*) deliberately rely on
// NetworkFirst-with-cache for offline scoring/voting and are NOT matched here.
// Matches both the HTML navigation request and the route's RSC payload (which
// shares the same pathname), so client-side navigation is covered too.
//   • /yip/dashboard/events/<id>/control   — organiser live control panel
//   • /yip/event/<id>/display              — public projector view
function isLiveOnly(pathname) {
  return (
    /^\/yip\/dashboard\/events\/[^/]+\/control(?:\/.*)?$/.test(pathname) ||
    /^\/yip\/event\/[^/]+\/display(?:\/.*)?$/.test(pathname)
  );
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();

      // Drop caches we don't own — EXCEPT the yi-future worker's (separate
      // registration at /yi-future/, same origin-wide cache store).
      for (const name of await caches.keys()) {
        if (!OWN_CACHES.includes(name) && !name.startsWith("v2-yifuture")) {
          await caches.delete(name);
        }
      }

      // Self-prime: cache the page each open tab is on right now. Closes the
      // "first visit was never controlled by the SW" gap.
      const pages = await caches.open(PAGES);
      const clientList = await self.clients.matchAll({ type: "window" });
      await Promise.allSettled(
        clientList.map(async (client) => {
          const url = new URL(client.url);
          if (url.origin !== self.location.origin) return;
          // Never prime live-only routes into the cache — they must stay
          // NetworkOnly (a primed control panel would be served stale later).
          if (isLiveOnly(url.pathname)) return;
          const res = await fetch(client.url, { credentials: "include" });
          if (res.ok && !res.redirected) await pages.put(client.url, res);
        })
      );
    })()
  );
});

function fetchWithTimeout(request, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(request, { signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // never touch POSTs / server actions
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Live organiser/projector routes: pure NetworkOnly. Go straight to the
  // network with no SW timeout, never write the cache, never fall back to a
  // cached copy. If the network is down these pages simply fail (the browser
  // shows its offline page) — which is correct, because there is nothing live
  // to control while offline. This is what prevents a stale control panel.
  if (isLiveOnly(url.pathname)) {
    event.respondWith(fetch(req, { cache: "no-store" }));
    return;
  }

  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:js|css|woff2?|ttf|png|jpe?g|svg|webp|ico)$/.test(url.pathname);

  if (req.mode === "navigate") {
    // Documents: fresh from the network when online; cached copy when the
    // venue internet dies.
    event.respondWith(
      (async () => {
        const cache = await caches.open(PAGES);
        try {
          const res = await fetchWithTimeout(req, 5000);
          if (res.ok && !res.redirected) cache.put(req, res.clone());
          return res;
        } catch (err) {
          const hit =
            (await cache.match(req)) || (await cache.match(url.pathname));
          if (hit) return hit;
          throw err;
        }
      })()
    );
    return;
  }

  if (isStatic) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC);
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })()
    );
    return;
  }

  // Everything else same-origin GET (incl. Next RSC payloads): network-first
  // with cache fallback so client-side navigation to visited routes still
  // resolves offline.
  event.respondWith(
    (async () => {
      const cache = await caches.open(ASSETS);
      try {
        const res = await fetchWithTimeout(req, 5000);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch (err) {
        const hit = await cache.match(req);
        if (hit) return hit;
        throw err;
      }
    })()
  );
});

// ── Push notifications (kept from the previous worker — root scope) ────────

self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();

  const options = {
    body: data.body,
    icon: data.icon || "/icons/icon-192x192.png",
    badge: data.badge || "/icons/badge-72x72.png",
    tag: data.tag || "yi-connect-notification",
    requireInteraction: data.requireInteraction || false,
    data: {
      url: data.url || "/dashboard",
      timestamp: Date.now(),
      ...data.data,
    },
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen =
    (event.notification.data && event.notification.data.url) || "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.focus();
            return client.navigate(urlToOpen);
          }
        }
        return self.clients.openWindow(urlToOpen);
      })
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
