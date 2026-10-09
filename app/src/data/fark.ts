/**
 * Değişiklik paketi: tarayıcı yalnızca değişen satırları sunucuya gönderir; sunucu aynı paketi denetleyip uygular.
 * Satırlar referansla karşılaştırılır (güncellemeler her zaman yeni nesne üretir).
 */
import type { Db } from "./model";

export const KOLEKSIYONLAR = [
  "subeler", "sezonlar", "dersler", "derslikler", "dersSaatleri", "gruplar",
  "personel", "kullanicilar", "girisler", "veliler", "ogrenciler", "kayitlar",
  "program", "tatiller", "iptaller", "yoklamalar", "izinler", "adaylar", "odevler",
  "musaitlikler", "randevular", "paketler", "olaylar", "gonderimler", "duyurular",
  "taksitler", "tahsilatlar", "giderler", "virmanlar", "islemler", "iceAktarmalar", "kvkk", "avanslar",
] as const;
export type Koleksiyon = (typeof KOLEKSIYONLAR)[number];
export const TEKILLER = ["kurum", "moduller", "fiyatListesi", "rolYetkileri", "ayarlar", "hakedisDurum", "otomasyon"] as const;
export type Tekil = (typeof TEKILLER)[number];

export type Satir = Record<string, unknown>;
export type Degisiklik = {
  koleksiyonlar: Partial<Record<Koleksiyon, { yaz: Satir[]; sil: string[] }>>;
  tekil: Partial<Record<Tekil, unknown>>;
};

/** Satır anahtarı: çoğu koleksiyonda id; yoklama ve iptallerde oturumId */
export const anahtar = (k: Koleksiyon, s: Satir) =>
  String(k === "yoklamalar" || k === "iptaller" ? s.oturumId : k === "olaylar" ? s.key : s.id);

export const satirlar = (db: Db, k: Koleksiyon): Satir[] => {
  const v = (db as unknown as Record<string, unknown>)[k];
  return (Array.isArray(v) ? v : Object.values((v as object) ?? {})) as Satir[];
};

export function farkHesapla(onceki: Db, sonraki: Db): Degisiklik {
  const d: Degisiklik = { koleksiyonlar: {}, tekil: {} };
  const o = onceki as unknown as Record<string, unknown>;
  const s = sonraki as unknown as Record<string, unknown>;
  for (const k of KOLEKSIYONLAR) {
    if (o[k] === s[k]) continue;
    const eski = new Map(satirlar(onceki, k).map((x) => [anahtar(k, x), x]));
    const yaz: Satir[] = [];
    const gorulen = new Set<string>();
    for (const x of satirlar(sonraki, k)) {
      const a = anahtar(k, x);
      gorulen.add(a);
      if (eski.get(a) !== x) yaz.push(x);
    }
    const sil = [...eski.keys()].filter((a) => !gorulen.has(a));
    if (yaz.length || sil.length) d.koleksiyonlar[k] = { yaz, sil };
  }
  for (const t of TEKILLER) if (o[t] !== s[t] && JSON.stringify(o[t]) !== JSON.stringify(s[t])) d.tekil[t] = s[t];
  return d;
}

export const farkBos = (d: Degisiklik) => !Object.keys(d.koleksiyonlar).length && !Object.keys(d.tekil).length;

/** Değişikliği uygular; değişmeyen koleksiyonların referansı korunur */
export function farkUygula(db: Db, d: Degisiklik): Db {
  const yeni = { ...db } as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(d.koleksiyonlar) as [Koleksiyon, { yaz: Satir[]; sil: string[] }][]) {
    const harita = new Map(satirlar(db, k).map((x) => [anahtar(k, x), x]));
    for (const id of v.sil) harita.delete(id);
    for (const x of v.yaz) harita.set(anahtar(k, x), x);
    const l = [...harita.values()];
    yeni[k] = k === "yoklamalar" ? Object.fromEntries(l.map((x) => [x.oturumId, x])) : l;
  }
  for (const [t, v] of Object.entries(d.tekil)) yeni[t] = v;
  return yeni as unknown as Db;
}
