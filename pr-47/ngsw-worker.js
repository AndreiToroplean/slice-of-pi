// Retires the offline service worker that earlier versions of the app installed (Angular's service worker, registered
// as `ngsw-worker.js`). Browsers check this script for updates; when an installed app finds this version, it takes over,
// deletes the offline caches and unregisters itself, so the app loads from the network from then on. Modeled on
// Angular's `safety-worker.js`. It can be deleted once no installs from before this change are left.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name.startsWith('ngsw:')).map((name) => caches.delete(name)),
      );
      await self.registration.unregister();
      // Reload open windows so they show the live version right away.
      const windows = await self.clients.matchAll({ type: 'window' });
      await Promise.allSettled(windows.map((client) => client.navigate(client.url)));
    })(),
  );
});
