/** Bu cihazın web push aboneliği (Bölüm 10 altyapısı; Bölüm 11: çıkışta cihaz aboneliği bırakılır) */
import { api } from "@/lib/api";

function anahtarCoz(b64: string) {
  const dolgu = "=".repeat((4 - (b64.length % 4)) % 4);
  const ham = atob((b64 + dolgu).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...ham].map((c) => c.charCodeAt(0)));
}
/** Cihazı web push'a abone eder ve aboneliği sunucuya kaydeder */
export async function pushAboneOl(): Promise<"tamam" | "izin-yok" | "desteklenmiyor"> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "desteklenmiyor";
  try {
    if ((await Notification.requestPermission()) !== "granted") return "izin-yok";
    const kayit = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const { anahtar } = await api<{ anahtar: string }>("/api/push/anahtar");
    const abonelik = (await kayit.pushManager.getSubscription()) ?? (await kayit.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: anahtarCoz(anahtar) }));
    await api("/api/veli/push/abone", { abonelik: abonelik.toJSON() });
    return "tamam";
  } catch {
    return "desteklenmiyor";
  }
}

async function cihazAboneligi(): Promise<PushSubscription | null> {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
    const kayit = await navigator.serviceWorker.getRegistration("/");
    return (await kayit?.pushManager.getSubscription()) ?? null;
  } catch {
    return null;
  }
}

/** Çıkışta sunucuya bildirilecek uç (bu cihazın aboneliği yoksa undefined) */
export async function cihazUcu(): Promise<string | undefined> {
  return (await cihazAboneligi())?.endpoint;
}

/** Çıkıştan sonra bu cihaz push almasın; hata çıkışı engellemez */
export async function cihazAboneliginiBirak(): Promise<void> {
  try {
    await (await cihazAboneligi())?.unsubscribe();
  } catch {
    /* sunucu kaydı zaten silindi */
  }
}
