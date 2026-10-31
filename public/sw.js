// Service worker Sam Flash : affiche les notifications push reçues.
self.addEventListener("push", (event) => {
  let data = { title: "Sam Flash", body: "Nouvelle notification.", url: "/" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // Charge utile non JSON : on garde le message par défaut.
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/favicon-512x512.png",
      badge: "/favicon-32x32.png",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || "/"));
});
