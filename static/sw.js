const CACHE_NAME = 'david888-wiki-shell-v7'
const IMAGE_CACHE_NAME = 'david888-wiki-images-v1'
const MAX_IMAGE_CACHE_ITEMS = 60
const OFFLINE_URL = '/_pwa-offline'

const PRECACHE_URLS = [
    OFFLINE_URL,
    '/app.webmanifest',
    '/notepad-icon-192.png',
    '/notepad-icon.png',
    '/notepad-icon.svg',
    '/favicon.ico',
    '/css/app.css',
    '/js/offline-store.mjs',
    '/js/pwa-install.mjs',
    '/js/marked.min.js',
    '/js/purify.min.js',
    '/js/markdown-toolbar.mjs',
    '/js/markdown-extensions.mjs',
    '/js/media-preview.mjs',
]

async function limitCacheSize(cacheName, maxItems = MAX_IMAGE_CACHE_ITEMS) {
    try {
        const cache = await caches.open(cacheName)
        const keys = await cache.keys()
        if (keys.length > maxItems) {
            const toDelete = keys.slice(0, keys.length - maxItems)
            await Promise.all(toDelete.map(k => cache.delete(k)))
        }
    } catch {}
}

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting()),
    )
})

self.addEventListener('activate', event => {
    const validCaches = [CACHE_NAME, IMAGE_CACHE_NAME]
    event.waitUntil(
        caches.keys()
            .then(cacheNames => Promise.all(
                cacheNames
                    .filter(cacheName => !validCaches.includes(cacheName))
                    .map(cacheName => caches.delete(cacheName)),
            ))
            .then(() => self.clients.claim()),
    )
})

self.addEventListener('fetch', event => {
    const { request } = event

    if (request.method !== 'GET') return

    const url = new URL(request.url)

    // 1. Navigation requests fallback to offline workspace if network fails
    if (request.mode === 'navigate') {
        if (url.origin !== self.location.origin) return
        event.respondWith(
            fetch(request).catch(async () => {
                const offlineFallback = await caches.match(OFFLINE_URL)
                return offlineFallback || new Response('Offline Workspace', { status: 503, headers: { 'Content-Type': 'text/plain' } })
            }),
        )
        return
    }

    // 2. Web App Manifest
    if (url.origin === self.location.origin && url.pathname === '/app.webmanifest') {
        event.respondWith(
            fetch(request)
                .then(response => {
                    const copy = response.clone()
                    caches.open(CACHE_NAME).then(cache => cache.put(request, copy))
                    return response
                })
                .catch(() => caches.match(request)),
        )
        return
    }

    // 3. Image & Media Caching (R2 images on s3.wiki.david888.com or local images)
    const isImageHost = (
        url.hostname === 's3.wiki.david888.com' ||
        url.hostname === 'box.david888.com' ||
        url.hostname.endsWith('.wiki.david888.com')
    )
    const isImageRequest = (
        request.destination === 'image' ||
        /\.(png|jpe?g|gif|webp|svg|ico|avif)(\?.*)?$/i.test(url.pathname) ||
        isImageHost
    )

    if (isImageRequest) {
        event.respondWith(
            caches.open(IMAGE_CACHE_NAME).then(async imageCache => {
                const cachedImage = await imageCache.match(request)
                const networkFetch = fetch(request)
                    .then(res => {
                        if (res && (res.status === 200 || res.type === 'opaque')) {
                            imageCache.put(request, res.clone())
                            limitCacheSize(IMAGE_CACHE_NAME, MAX_IMAGE_CACHE_ITEMS)
                        }
                        return res
                    })
                    .catch(() => null)

                const resolved = cachedImage || (await networkFetch)
                if (resolved) return resolved
                return new Response(
                    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
                    { headers: { 'Content-Type': 'image/svg+xml' } }
                )
            }),
        )
        return
    }

    // 4. External CDN JS/CSS/Wasm Caching (esm.sh, jsdelivr, cdnjs for remark, rehype, katex, mermaid, etc.)
    const isCdnHost = (
        url.hostname === 'esm.sh' ||
        url.hostname === 'cdn.jsdelivr.net' ||
        url.hostname === 'cdnjs.cloudflare.com'
    )
    const isCdnAsset = isCdnHost && (
        request.destination === 'script' ||
        request.destination === 'style' ||
        request.destination === 'font' ||
        /\.(js|mjs|css|wasm|woff2?|ttf)(\?.*)?$/i.test(url.pathname)
    )

    if (isCdnAsset) {
        event.respondWith(
            caches.open(CACHE_NAME).then(async cache => {
                const cachedResponse = await cache.match(request)
                const networkFetch = fetch(request)
                    .then(networkResponse => {
                        if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
                            cache.put(request, networkResponse.clone())
                        }
                        return networkResponse
                    })
                    .catch(() => null)

                const resolved = cachedResponse || (await networkFetch)
                return resolved || Response.error()
            }),
        )
        return
    }

    if (url.origin !== self.location.origin) return

    // 5. Stale-While-Revalidate for local JS, CSS, Fonts, and Precached Assets
    const isStaticAsset = (
        PRECACHE_URLS.includes(url.pathname) ||
        url.pathname.startsWith('/js/') ||
        url.pathname.startsWith('/css/') ||
        url.pathname.startsWith('/fonts/') ||
        url.pathname.startsWith('/wasm/') ||
        /\.(css|js|mjs|wasm|woff2?|ttf|eot)$/i.test(url.pathname)
    )

    if (!isStaticAsset) return

    event.respondWith(
        caches.open(CACHE_NAME).then(async cache => {
            const cachedResponse = await cache.match(request)
            const networkFetch = fetch(request)
                .then(networkResponse => {
                    if (networkResponse && networkResponse.status === 200) {
                        cache.put(request, networkResponse.clone())
                    }
                    return networkResponse
                })
                .catch(() => null)

            const resolved = cachedResponse || (await networkFetch)
            return resolved || Response.error()
        }),
    )
})

// Background Sync Event (When online connection is restored in background)
self.addEventListener('sync', event => {
    if (event.tag === 'sync-pending-notes') {
        event.waitUntil(
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({ type: 'BACKGROUND_SYNC_TRIGGER' })
                })
            }),
        )
    }
})
