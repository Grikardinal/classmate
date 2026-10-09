/* Classmate service worker — ana ekrana ekleme (PWA) ve web push bildirimleri için.
   Önbellekleme bilinçli olarak yapılmıyor: veriler her zaman güncel gelsin. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let veri = { baslik: "Classmate", metin: "Yeni bildiriminiz var.", url: "/veli/bildirimler" };
  try {
    veri = { ...veri, ...e.data.json() };
  } catch (_) {
    /* düz metin */
  }
  e.waitUntil(self.registration.showNotification(veri.baslik, { body: veri.metin, icon: "/logo-mark.svg", data: { url: veri.url } }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.openWindow(e.notification.data?.url || "/veli"));
});
