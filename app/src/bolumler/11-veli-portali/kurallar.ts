/**
 * Bölüm 11 saf iş kuralları: ekran ve sunucu ortak kullanır (yalnızca göreli içe aktarma).
 */
import { taksitKalan, type BildirimOlayi, type Db, type Duyuru, type Gonderim, type Odev, type Ogrenci, type ProgramSatiri, type Randevu, type Taksit } from "../../data/model";
import { devamsizlikOzeti, type YoklamaDurumu } from "../../lib/kurallar";
import { ogrenciSonucu, veliIptalEngeli } from "../09-etut/kurallar";

const DK = 60_000;

/** SMS bombalama ve kod tahmini sınırları (deneme: en çok, pencere: ms) */
export const GIRIS_SINIRLARI = {
  kodIp: { sinir: 20, pencere: 10 * DK },
  kodTelefon: { sinir: 3, pencere: 10 * DK },
  kodTelefonGun: { sinir: 10, pencere: 24 * 60 * DK },
  girisIp: { sinir: 30, pencere: 10 * DK },
} as const;

/** Veli yazma uçları (veli başına) */
export const YAZMA_SINIRLARI = {
  genel: { sinir: 120, pencere: DK },
  izin: { sinir: 30, pencere: 60 * DK },
  randevu: { sinir: 30, pencere: 60 * DK },
} as const;

export type KodHataNedeni = "yok" | "sure" | "deneme" | "hatali";

/** Kayıtsız numaraya da sahte kod üretildiği için bu mesajlar numaranın kayıtlı olup olmadığını ele vermez */
export function kodHataMesaji(neden: KodHataNedeni, kalan?: number): string {
  if (neden === "deneme") return "Çok fazla hatalı deneme. Yeni kod isteyin.";
  if (neden === "sure") return "Kodun süresi doldu. Yeni kod isteyin.";
  if (neden === "yok") return "Önce kod isteyin.";
  return kalan === undefined ? "Kod hatalı." : `Kod hatalı. Kalan deneme: ${kalan}`;
}

/** Kapalı modülün (finans, ödev, etüt, ön kayıt) geçmiş bildirimi veliye gösterilmez; giriş kodu hiç gösterilmez */
export function veliGonderimGorunur(g: Pick<Gonderim, "olay">, olaylar: Pick<BildirimOlayi, "key" | "finans" | "modul">[], moduller: Db["moduller"]): boolean {
  if (g.olay === "otp") return false;
  const t = olaylar.find((o) => o.key === g.olay);
  if (t?.finans && !moduller.finans) return false;
  if (t?.modul && moduller[t.modul] === false) return false;
  return true;
}

const cocugaAit = (o: Pick<Odev, "grupId" | "ogrenciIds">, grupId: string, ogrenciId: string) => o.grupId === grupId && (!o.ogrenciIds || o.ogrenciIds.includes(ogrenciId));

export function ogrenciOdevleri<T extends Pick<Odev, "grupId" | "ogrenciIds" | "teslim">>(odevler: T[], grupId: string, ogrenciId: string): T[] {
  return odevler.filter((o) => cocugaAit(o, grupId, ogrenciId)).sort((a, b) => b.teslim.localeCompare(a.teslim));
}

/** Teslim tarihi geçmemiş ve henüz kontrol edilip işaretlenmemiş ödevler (en yakın teslim önce) */
export function bekleyenOdevler<T extends Pick<Odev, "grupId" | "ogrenciIds" | "teslim" | "teslimler">>(odevler: T[], grupId: string, ogrenciId: string, bugun: string): T[] {
  return odevler.filter((o) => cocugaAit(o, grupId, ogrenciId) && o.teslim >= bugun && !o.teslimler[ogrenciId]).sort((a, b) => a.teslim.localeCompare(b.teslim));
}

export function veliDuyurulari<T extends Pick<Duyuru, "zamanlanmis" | "aliciVeliIds" | "zaman">>(duyurular: T[], veliId: string): T[] {
  return duyurular.filter((d) => !d.zamanlanmis && d.aliciVeliIds.includes(veliId)).sort((a, b) => b.zaman.localeCompare(a.zaman));
}

export function okunmamisDuyuruSayisi(duyurular: Pick<Duyuru, "zamanlanmis" | "aliciVeliIds" | "zaman" | "okuyanVeliIds">[], veliId: string): number {
  return veliDuyurulari(duyurular, veliId).filter((d) => !d.okuyanVeliIds.includes(veliId)).length;
}

export function acikTaksitler(taksitler: Taksit[], ogrenciId: string): Taksit[] {
  return taksitler.filter((t) => t.ogrenciId === ogrenciId && taksitKalan(t) > 0).sort((a, b) => a.vade.localeCompare(b.vade));
}

/** Karar 2026-11-09: kaydı sona eren çocuğun yalnızca açık taksitleri; açık borcu olmayan çocuk hiç dönmez */
export function ayrilanAcikBorclar<O extends Pick<Ogrenci, "id" | "veliIds" | "durum">>(ogrenciler: O[], taksitler: Taksit[], veliId: string): { ogrenciler: O[]; taksitler: Taksit[] } {
  const ayrilan = ogrenciler.filter((o) => o.veliIds.includes(veliId) && o.durum !== "aktif");
  const acik = taksitler.filter((t) => taksitKalan(t) > 0 && ayrilan.some((o) => o.id === t.ogrenciId));
  return { ogrenciler: ayrilan.filter((o) => acik.some((t) => t.ogrenciId === o.id)), taksitler: acik };
}

export function taksitOzeti(taksitler: Taksit[], bugun: string): { kalan: number; geciken: number } {
  return {
    kalan: taksitler.reduce((s, t) => s + taksitKalan(t), 0),
    geciken: taksitler.filter((t) => t.vade < bugun && taksitKalan(t) > 0).reduce((s, t) => s + taksitKalan(t), 0),
  };
}

/** Ortak devamsızlık hesabıyla devam oranı (izinli dersler hariç); hesaplanacak ders yoksa "—" */
export function devamMetni(durumlar: YoklamaDurumu[]): string {
  const o = devamsizlikOzeti(durumlar);
  return o.payda > 0 ? `%${Math.round((1 - o.oran) * 100)}` : "—";
}

/** Grubun bugün geçerli program satırlarından öğretmenler ve verdikleri dersler (kapanmış satırlar sayılmaz) */
export function grupOgretmenleri(program: Pick<ProgramSatiri, "grupId" | "ogretmenId" | "dersId" | "bitis">[], grupId: string): { ogretmenId: string; dersIds: string[] }[] {
  const m = new Map<string, Set<string>>();
  for (const p of program) {
    if (p.grupId !== grupId || p.bitis) continue;
    m.set(p.ogretmenId, (m.get(p.ogretmenId) ?? new Set<string>()).add(p.dersId));
  }
  return [...m].map(([ogretmenId, d]) => ({ ogretmenId, dersIds: [...d] }));
}

export type RandevuIptalDurumu = "acik" | "sure-gecti" | "sonuc";

/** Ekran sunucuyla aynı kuralı (veliIptalEngeli) kullanır */
export function randevuIptalDurumu(r: Pick<Randevu, "tarih" | "bas" | "durum">, iptalSaat: number, an: { bugun: string; simdi: string }): RandevuIptalDurumu {
  if (r.durum !== "planli" || r.tarih < an.bugun) return "sonuc";
  return veliIptalEngeli(r, iptalSaat, an) ? "sure-gecti" : "acik";
}

const SONUC_ROZET = {
  planli: { ad: "Planlı", ton: "default" },
  yapildi: { ad: "Yapıldı", ton: "success" },
  gelmedi: { ad: "Gelmedi", ton: "danger" },
  iptal: { ad: "İptal", ton: "secondary" },
} as const;

/** Grup etüdünde yalnızca bu öğrencinin sonucu */
export function randevuRozeti(r: Pick<Randevu, "durum" | "sonuclar">, ogrenciId: string) {
  return SONUC_ROZET[ogrenciSonucu(r, ogrenciId)];
}
