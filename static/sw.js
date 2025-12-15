self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};

  event.waitUntil(
    self.registration.showNotification(data.title || "UPLAB", {
      body: data.body || "Nova notificação",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: data.url
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data || "/")
  );
});
