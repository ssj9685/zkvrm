/// <reference lib="webworker" />

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE_NAME = "zkvrm-pwa-v1";
const PRECACHE_URLS = [
	"/",
	"/manifest.webmanifest",
	"/assets/zkvrm.svg",
	"/assets/icons/icon-180.png",
	"/assets/icons/icon-192.png",
	"/assets/icons/icon-512.png",
	"/assets/screenshots/dashboard-wide.png",
	"/assets/screenshots/dashboard-mobile.png",
];
const STATIC_EXTENSIONS = [
	".html",
	".js",
	".css",
	".svg",
	".png",
	".webmanifest",
	".woff2",
];

function shouldCache(url: URL): boolean {
	if (url.pathname === "/") return true;
	return STATIC_EXTENSIONS.some((ext) => url.pathname.endsWith(ext));
}

sw.addEventListener("install", (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE_NAME);
			await cache.addAll(PRECACHE_URLS);
		})()
	);
	sw.skipWaiting();
});

sw.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(
				keys.map((key) => {
					if (key !== CACHE_NAME) {
						return caches.delete(key);
					}
					return Promise.resolve(true);
				})
			);
		})()
	);
	sw.clients.claim();
});

sw.addEventListener("fetch", (event) => {
	const { request } = event;
	if (request.method !== "GET") return;

	const url = new URL(request.url);
	if (url.origin !== sw.location.origin || !shouldCache(url)) return;

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE_NAME);
			const cached = await cache.match(request);
			if (cached) return cached;

			try {
				const response = await fetch(request);
				if (response.status === 200 && response.type === "basic") {
					cache.put(request, response.clone());
				}
				return response;
			} catch (error) {
				if (request.mode === "navigate") {
					const fallback = await cache.match("/");
					if (fallback) return fallback;
				}
				if (cached) return cached;
				throw error;
			}
		})()
	);
});

export {};
