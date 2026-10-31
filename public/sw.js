/* ============================================================
   France Santé Transport — Service Worker
   Notifications push navigateur (Web Push VAPID) + manifeste.
   ============================================================ */
const APP = "France Santé Transport";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * Évènement push : le serveur envoie { title, body, url } chiffré.
 * Sur mobile (Android/Chrome) la notification doit être affichée
 * depuis ce worker pour apparaître hors de la page.
 */
self.addEventListener("push", (event) => {
  let payload = { title: APP, body: "Vous avez une nouvelle notification.", url: "/dashboard/notifications" };
  try {
    if (event.data) {
      const data = event.data.json();
      if (data && typeof data === "object") payload = { ...payload, ...data };
    }
  } catch {
    // payload texte brut
    try { payload.body = event.data ? event.data.text() : payload.body; } catch { /* noop */ }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || APP, {
      body: payload.body,
      icon: "/logo.png",
      badge: "/logo.png",
      tag: payload.tag || undefined,
      renotify: Boolean(payload.tag),
      data: { url: payload.url || "/dashboard/notifications" },
      vibrate: [200, 100, 200],
    }),
  );
});

// Clic sur la notification → ouverture/focus de la cible
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard/notifications";
  event.waitUntil(
    (async () => {
      const absolute = new URL(url, self.location.origin).href;
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin)) {
          await client.focus();
          client.navigate(absolute);
          return;
        }
      }
      await self.clients.openWindow(absolute);
    })(),
  );
});
