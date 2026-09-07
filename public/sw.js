const CACHE = "shelfos-shell-v3";
const SHELL = ["/", "/pos", "/inventory", "/shifts", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL).catch(() => undefined)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  // OAuth redirects must always hit the network — never cache or fallback them.
  if (url.pathname.startsWith("/~oauth")) return;
  // Auth screens and API calls always go straight to the network.
  if (
    url.pathname.startsWith("/api") ||
    url.pathname === "/login" ||
    url.pathname === "/reset-password"
  )
    return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => undefined);
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        const shell = await caches.match("/pos");
        return shell ?? new Response("Offline", { status: 503 });
      }),
  );
});
