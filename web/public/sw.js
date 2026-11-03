/* Ranna service worker: web-push notifications for customer calls. */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// A fetch handler keeps the PWA installable; the network serves the requests.
self.addEventListener("fetch", () => {
  /* no-op: presence of a fetch handler satisfies installability */;
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "رنّة · Ranna", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "رنّة · Ranna";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    // Web Push has NO supported custom-sound field. The sound is decided by the
    // Android notification channel for this app (Settings → Apps → رنّة →
    // Notifications → the channel → Sound). `silent: false` just asks for that
    // channel's configured sound.
    silent: false,
    vibrate: [200, 100, 200, 100, 400],
    tag: "ranna-order-" + (data.orderNumber || "update"),
    renotify: true,
    requireInteraction: true,
    data: { url: data.url || "/" },
    actions: [{ action: "open", title: "فتح · Open" }],
  };

  event.waitUntil(
    self.registration
      .showNotification(title, options)
      .catch(() =>
        self.registration.showNotification(title, { body: data.body || "" })
      )
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clientsList) {
        if (client.url.includes(target) || target === "/") {
          if ("focus" in client) return client.focus();
        }
      }
      for (const client of clientsList) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })()
  );
});
