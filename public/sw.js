const CACHE = 'eh27-bins-v1';
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(['/', '/icon.svg', '/manifest.webmanifest']))); self.skipWaiting(); });
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if(event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith(fetch(event.request).then(response => {
    if(response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); }
    return response;
  }).catch(async () => (await caches.match(event.request)) || (event.request.mode === 'navigate' ? await caches.match('/') : Response.error())));
});
self.addEventListener('push', event => {
  let payload = {title:'EH27 Bins',body:'Check your upcoming bin collection.'};
  try { payload = {...payload, ...event.data.json()}; } catch {}
  event.waitUntil(self.registration.showNotification(payload.title, {body:payload.body,icon:'/icon-192.png',badge:'/icon-192.png',tag:payload.tag || 'eh27-reminder',data:{url:'/'}}));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients => {
    for(const client of clients) { if(new URL(client.url).origin === self.location.origin) { await client.navigate('/'); return client.focus(); } }
    return self.clients.openWindow('/');
  }));
});
