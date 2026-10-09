/**
 * Tarayıcı veri deposu. Veri sunucudan gelir (kullanıcının yetkisine göre süzülmüş halde);
 * guncelle() değişikliği ekrana hemen yansıtır, ardından yalnızca değişen satırları sunucuya gönderir.
 * Sunucu reddederse (yetki, şube kapsamı) kullanıcı uyarılır ve sunucudaki doğru hal yeniden yüklenir.
 * Kişisel veriler tarayıcıda kalıcı olarak saklanmaz.
 */
import { useSyncExternalStore } from "react";
import { tanimKaynagi, type Db } from "./model";
import { farkBos, farkHesapla, type Degisiklik } from "./fark";
import { api, ApiHatasi } from "@/lib/api";
import { toast } from "@/components/ui";

export * from "./model";

export type VeriKaynagi = "personel" | "veli";

let db: Db | null = null;
let kaynak: VeriKaynagi = "personel";
const dinleyiciler = new Set<() => void>();
const bildir = () => dinleyiciler.forEach((l) => l());

let kuyruk: Promise<void> = Promise.resolve();
let bekleyen = 0;
let yenilemeSayaci = 0;

function ayarla(yeni: Db) {
  db = yeni;
  tanimKaynagi(db);
  bildir();
}

/** Sunucudan güncel veriyi yükler (bekleyen yazmalar bittikten sonra) */
export async function veriYukle(k: VeriKaynagi = kaynak): Promise<void> {
  kaynak = k;
  await kuyruk;
  const sayac = ++yenilemeSayaci;
  const yeni = await api<Db>(k === "veli" ? "/api/veli/veri" : "/api/veri");
  // Bu sırada yeni bir değişiklik kuyruğa girdiyse eski yanıtı uygulama
  if (sayac !== yenilemeSayaci || bekleyen > 0) return;
  ayarla(yeni);
}

export function veriyiTemizle() {
  db = null;
  bildir();
}

export function getDb(): Db {
  if (!db) throw new Error("Veri henüz yüklenmedi");
  return db;
}

/** Değişmez güncelleme: fn taslak kopya üzerinde çalışır; fark sunucuya gönderilir. */
export function guncelle(fn: (d: Db) => void) {
  const onceki = getDb();
  const taslak = { ...onceki } as Db;
  for (const k of Object.keys(taslak) as (keyof Db)[]) {
    const v = taslak[k];
    if (Array.isArray(v)) (taslak as Record<string, unknown>)[k] = [...v];
    else if (v && typeof v === "object") (taslak as Record<string, unknown>)[k] = { ...(v as object) };
  }
  fn(taslak);
  const fark = farkHesapla(onceki, taslak);
  ayarla(taslak);
  if (farkBos(fark)) return;
  gonder(fark);
}

function gonder(fark: Degisiklik) {
  if (kaynak === "veli") return; // veli portalı yazmaları kendi uçlarından gider
  bekleyen++;
  kuyruk = kuyruk
    .then(() => api("/api/degisiklik", fark))
    .then(() => {
      // Sunucu gönderim durumlarını (SMS/push) işledikten sonra güncel hali al
      if (fark.koleksiyonlar.gonderimler) setTimeout(() => void veriYukle().catch(() => undefined), 1500);
    })
    .catch(async (e) => {
      toast(e instanceof ApiHatasi ? e.message : "Değişiklik kaydedilemedi.", "hata");
      if (e instanceof ApiHatasi && e.durum === 401) window.location.assign("/giris");
      bekleyen = 0;
      await veriYukle().catch(() => undefined);
    })
    .finally(() => {
      bekleyen = Math.max(0, bekleyen - 1);
    });
}

/** Bekleyen tüm değişiklikler sunucuya yazılana kadar bekler (sunucu ucunu çağırmadan önce) */
export function senkron(): Promise<void> {
  return kuyruk;
}

export function useDb(): Db {
  return useSyncExternalStore(
    (l) => {
      dinleyiciler.add(l);
      return () => dinleyiciler.delete(l);
    },
    () => db as Db,
  );
}

/** Veri yüklü mü (yükleme ekranı için) */
export function useVeriHazir(): boolean {
  return useSyncExternalStore(
    (l) => {
      dinleyiciler.add(l);
      return () => dinleyiciler.delete(l);
    },
    () => db !== null,
  );
}

// Sekmeye dönüldüğünde ve dakikada bir sunucudaki değişiklikleri al (diğer kullanıcılar, gönderim durumları)
if (typeof window !== "undefined") {
  const yenile = () => db && document.visibilityState === "visible" && void veriYukle().catch(() => undefined);
  window.addEventListener("focus", yenile);
  setInterval(yenile, 60_000);
}
