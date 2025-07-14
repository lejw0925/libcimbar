// Cimbar 离线扫描器 Service Worker
// 支持 PWA 离线功能

const CACHE_NAME = 'cimbar-scanner-v1.0.0';
const urlsToCache = [
    '/',
    '/cimbar_scanner.html',
    '/index.html',
    '/decoder.html',
    '/main.js',
    '/decoder.js',
    '/cimbar_decoder_wasm.js',
    '/cimbar_js.js',
    '/cimbar_js.wasm',
    '/pwa.json',
    '/favicon.ico',
    '/icon-192x192.png',
    '/icon-512x512.png'
];

// 安装 Service Worker
self.addEventListener('install', event => {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Caching files');
                return cache.addAll(urlsToCache);
            })
            .catch(error => {
                console.error('Service Worker: Cache installation failed:', error);
            })
    );
});

// 激活 Service Worker
self.addEventListener('activate', event => {
    console.log('Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // 删除旧版本的缓存
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// 拦截网络请求
self.addEventListener('fetch', event => {
    // 只处理 GET 请求
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // 如果缓存中有该资源，直接返回
                if (response) {
                    console.log('Service Worker: Serving from cache:', event.request.url);
                    return response;
                }

                // 如果缓存中没有，尝试从网络获取
                return fetch(event.request)
                    .then(response => {
                        // 检查响应是否有效
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // 克隆响应（因为响应是流，只能使用一次）
                        const responseToCache = response.clone();

                        // 将新获取的资源添加到缓存
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    })
                    .catch(error => {
                        console.log('Service Worker: Fetch failed, serving offline fallback');
                        
                        // 如果请求失败且是页面请求，返回离线页面
                        if (event.request.destination === 'document') {
                            return caches.match('/cimbar_scanner.html');
                        }
                        
                        // 其他情况抛出错误
                        throw error;
                    });
            })
    );
});

// 处理推送通知（可选）
self.addEventListener('push', event => {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: '/icon-192x192.png',
            badge: '/icon-192x192.png',
            vibrate: [100, 50, 100],
            data: {
                url: data.url
            }
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

// 处理通知点击
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    if (event.notification.data && event.notification.data.url) {
        event.waitUntil(
            clients.openWindow(event.notification.data.url)
        );
    }
});

// 处理后台同步（可选）
self.addEventListener('sync', event => {
    if (event.tag === 'background-sync') {
        console.log('Service Worker: Background sync triggered');
        // 这里可以处理后台数据同步
    }
});

// 监听消息
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_NAME });
    }
});
