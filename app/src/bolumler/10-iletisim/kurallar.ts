/**
 * Bölüm 10 saf kuralları: ekran ve sunucu (politika, gönderim, uygulama) ortak kullanır.
 * Yalnızca göreli içe aktarma.
 */
import type { Ayarlar, BildirimOlayi, Duyuru, Gonderim, OlayKey } from "../../data/model";
import { dakika, kanalSec, type VarsayilanKanal } from "../../lib/kurallar";

export type Hata = string | null;

export const BASLIK_SINIR = 120;
export const METIN_SINIR = 1000;
export const SABLON_SINIR = 500;
/** Personelin başarısız satırı elle kaç kez yeniden kuyruğa alabileceği */
export const MAKS_DENEME = 3;
/** Şablon değişkenine sığabilecek en uzun değer (ödev başlığı, iptal nedeni gibi) */
const DEGISKEN_SINIR = 300;
export const TAKILI_HATA = "Gönderim yarıda kaldı; iletilip iletilmediği bilinmiyor. Kontrol edip gerekirse elle tekrar gönderin.";
export const RIZA_YOK_HATA = "Adayın iletişim izni (açık rıza) yok; SMS gönderilmedi.";

/* ---------- Şablonlar ---------- */
const ORTAK = ["ogrenci", "grup", "sube_adi", "sube_telefonu"];
const DERS = ["ders", "saat", "tarih"];
/** Olayı üreten kodun verdiği değişkenler: şablonda bunların dışındaki değişken veliye "{x}" olarak giderdi */
const OLAY_DEGISKENLERI: Record<OlayKey, string[]> = {
  devamsizlik: [...ORTAK, ...DERS],
  devamsizlikGecmis: [...ORTAK, ...DERS],
  devamsizlikDuzeltme: [...ORTAK, ...DERS],
  dersIptal: [...ORTAK, ...DERS, "neden"],
  hosgeldin: ORTAK,
  yeniOdev: [...ORTAK, "ders", "baslik", "teslim"],
  odevYapmadi: [...ORTAK, "ders", "baslik"],
  odevHatirlatma: [...ORTAK, "ders", "baslik"],
  odevDuzeltme: [...ORTAK, "ders", "baslik"],
  etutHatirlatma: [...ORTAK, "tarih", "saat", "ogretmen"],
  etutIptal: [...ORTAK, "tarih", "saat", "ogretmen"],
  paketBitiyor: [...ORTAK, "metin"],
  duyuru: [...ORTAK, "baslik", "metin"],
  taksitHatirlatma: [...ORTAK, "tutar", "vade"],
  gecikmisOdeme: [...ORTAK, "tutar", "vade"],
  odemeAlindi: [...ORTAK, "tutar", "makbuz"],
  onKayitTesekkur: ["sube_adi", "sube_telefonu"], // aday henüz öğrenci değil
};

export const izinliDegiskenler = (olay: string): string[] => OLAY_DEGISKENLERI[olay as OlayKey] ?? ORTAK;
export const sablonDegiskenleri = (sablon: string): string[] => [...new Set([...sablon.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))];

export function sablonEngeli(olay: string, sablon: unknown): Hata {
  if (typeof sablon !== "string" || !sablon.trim()) return "Şablon metni boş olamaz.";
  if (sablon.length > SABLON_SINIR) return `Şablon en fazla ${SABLON_SINIR} karakter olabilir.`;
  const izinli = izinliDegiskenler(olay);
  const yanlis = sablonDegiskenleri(sablon).filter((d) => !izinli.includes(d));
  return yanlis.length ? `Bu olayda kullanılamayan değişken: ${yanlis.map((d) => `{${d}}`).join(", ")}` : null;
}

export function olayYazmaEngeli(yeni: BildirimOlayi, eski: BildirimOlayi | undefined): Hata {
  if (!eski) return "Yeni bildirim olayı eklenemez.";
  if (yeni.ad !== eski.ad || yeni.finans !== eski.finans || yeni.modul !== eski.modul) return "Olayın tanımı değiştirilemez; yalnızca kanal, durum ve metin değişir.";
  if (!(["push", "sms", "push+sms"] as VarsayilanKanal[]).includes(yeni.kanal)) return "Geçersiz kanal.";
  if (typeof yeni.aktif !== "boolean") return "Geçersiz durum.";
  return sablonEngeli(yeni.key, yeni.sablon);
}

const saatGecerli = (s: unknown) => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

/** Yalnızca değişen iletişim ayarları denetlenir (ayarlar başka bölümlerce de yazılır) */
export function ayarEngeli(yeni: Partial<Ayarlar> | undefined, eski: Pick<Ayarlar, "gonderimBas" | "gonderimBit" | "smsBirimFiyat">): Hata {
  if (!yeni) return null;
  if (yeni.gonderimBas !== eski.gonderimBas || yeni.gonderimBit !== eski.gonderimBit) {
    if (!saatGecerli(yeni.gonderimBas) || !saatGecerli(yeni.gonderimBit)) return "Gönderim saatleri geçersiz.";
    if (dakika(yeni.gonderimBas!) >= dakika(yeni.gonderimBit!)) return "Gönderim aralığında başlangıç bitişten önce olmalı.";
  }
  if (yeni.smsBirimFiyat !== eski.smsBirimFiyat && !(typeof yeni.smsBirimFiyat === "number" && Number.isFinite(yeni.smsBirimFiyat) && yeni.smsBirimFiyat >= 0 && yeni.smsBirimFiyat <= 100)) return "SMS birim fiyatı 0 ile 100 ₺ arasında olmalı.";
  return null;
}

/**
 * Metin şablonun kalıbına uyuyor mu: sabit parçalar sırayla, aralarındaki değişkenler makul uzunlukta.
 * Personelin serbest metni kurumun başlığıyla SMS olarak gidemesin diye (doğrusal tarama; düzenli ifade yok).
 */
export function metinSablonaUyar(metin: string, sablon: string): boolean {
  const parcalar = sablon.split(/\{\w+\}/);
  if (!metin.startsWith(parcalar[0])) return false;
  let konum = parcalar[0].length;
  for (let i = 1; i < parcalar.length; i++) {
    const p = parcalar[i];
    const son = i === parcalar.length - 1;
    const bulunan = son ? (metin.endsWith(p) ? metin.length - p.length : -1) : metin.indexOf(p, konum);
    if (bulunan < konum || bulunan - konum > DEGISKEN_SINIR) return false;
    konum = bulunan + p.length;
  }
  return parcalar.length > 1 || metin === sablon;
}

/* ---------- Personelin yazabildiği gönderim satırı ---------- */
/** Bu olayların satırını yalnızca sunucu üretir; istemciden gelen satır düşer (duyuru satırları duyurudan yeniden üretilir) */
const YALNIZ_SUNUCU = new Set<string>(["otp", "devamsizlikDuzeltme", "odevDuzeltme", "etutIptal", "duyuru"]);
export const yalnizSunucuOlayi = (olay: string) => YALNIZ_SUNUCU.has(olay);

/** Olayı üretebilen bölüm yetkileri */
const OLAY_YETKI: Record<string, string[]> = {
  devamsizlik: ["07"], devamsizlikGecmis: ["07"],
  dersIptal: ["06"],
  hosgeldin: ["04", "02", "14"],
  yeniOdev: ["08"], odevYapmadi: ["08"], odevHatirlatma: ["08"],
  etutHatirlatma: ["09"], paketBitiyor: ["09"],
  taksitHatirlatma: ["05"], gecikmisOdeme: ["05"], odemeAlindi: ["05"],
  onKayitTesekkur: ["03", "04"],
};
const OGRETMEN_OLAYLARI = new Set(["devamsizlik", "devamsizlikGecmis", "yeniOdev", "odevYapmadi", "odevHatirlatma", "etutHatirlatma", "paketBitiyor"]);

export function olayUretmeYetkisi(olay: string, rol: string, yetkiVar: (bolum: string) => boolean): boolean {
  if (rol === "genel-yonetici") return true;
  if (rol === "ogretmen" && !OGRETMEN_OLAYLARI.has(olay)) return false;
  return (OLAY_YETKI[olay] ?? []).some(yetkiVar);
}

type OlayDurumu = Pick<BildirimOlayi, "aktif" | "finans" | "modul">;
export function olayCalisir(t: OlayDurumu, moduller: Record<string, boolean | undefined>): boolean {
  if (!t.aktif) return false;
  if (t.finans && moduller.finans !== true) return false;
  return !t.modul || moduller[t.modul] !== false;
}

/** Sunucunun kanal kararı: istemcinin kanalı dikkate alınmaz; izin yoksa veya metin şablona uymuyorsa SMS olmaz */
export function gonderimKanali(tanim: Pick<BildirimOlayi, "kanal">, veli: { pushAcik: boolean; izinSms?: boolean }, metinUygun: boolean): "push" | "sms" {
  const k = kanalSec(tanim.kanal, veli.pushAcik);
  return k === "sms" && veli.izinSms !== false && metinUygun ? "sms" : "push";
}

export const metinEngeli = (metin: unknown): Hata => (typeof metin !== "string" || !metin.trim() ? "Bildirim metni boş olamaz." : metin.length > METIN_SINIR ? "Bildirim metni çok uzun." : null);

/** Başarısız satırı elle yeniden kuyruğa alma */
export function tekrarEngeli(eski: Pick<Gonderim, "durum" | "olay" | "deneme">, yetkili: boolean): Hata {
  if (eski.durum !== "basarisiz" || !yetkili) return "Gönderim kaydı değiştirilemez.";
  if (eski.olay === "otp") return "Giriş kodu yeniden gönderilemez; veli yeni kod istemeli.";
  if ((eski.deneme ?? 0) >= MAKS_DENEME) return `Bu mesaj en fazla ${MAKS_DENEME} kez yeniden gönderilebilir.`;
  return null;
}
export const tekrarEdilebilir = (g: Pick<Gonderim, "durum" | "olay" | "deneme">) => tekrarEngeli(g, true) === null;

/** Önceki çalışmada sağlayıcıya verilip sonucu yazılamamış satırlar. Çift SMS olmasın diye yeniden gönderilmez. */
export function takiliSatirlar<T extends Pick<Gonderim, "durum" | "gonderimBasladi">>(gonderimler: T[]): T[] {
  return gonderimler.filter((g) => g.durum === "bekliyor" && !!g.gonderimBasladi);
}

/* ---------- Netgsm ---------- */
const NETGSM_HATALARI: Record<string, string> = {
  "20": "Mesaj metni hatalı veya çok uzun",
  "30": "Kullanıcı adı, şifre, API yetkisi veya IP kısıtı hatalı",
  "40": "Mesaj başlığı tanımlı değil",
  "50": "İYS kontrollü gönderim yapılamıyor",
  "51": "İYS marka bilgisi tanımlı değil",
  "70": "Hatalı parametre",
  "80": "Gönderim sınırı aşıldı",
  "85": "Aynı numaraya mükerrer gönderim sınırı aşıldı",
};

/** Başarı yalnızca HTTP 200 ve "00" / "01" / "02" koduyla; diğer her yanıt hatadır */
export function netgsmYanitiCoz(httpDurum: number, govde: string): { tamam: true; ref?: string } | { tamam: false; hata: string } {
  const [kod, ref] = govde.trim().split(/\s+/);
  if (httpDurum === 200 && ["00", "01", "02"].includes(kod)) return { tamam: true, ref };
  if (httpDurum !== 200) return { tamam: false, hata: `Netgsm HTTP ${httpDurum}` };
  if (!kod) return { tamam: false, hata: "Netgsm boş yanıt" };
  return { tamam: false, hata: /^\d{1,4}$/.test(kod) ? `Netgsm ${kod}: ${NETGSM_HATALARI[kod] ?? "Bilinmeyen hata kodu"}` : "Netgsm: Bilinmeyen yanıt" };
}

/** Hata metninden kimlik bilgilerini çıkarır (gönderim kaydında personele görünür, günlüğe yazılabilir) */
export function sirlariGizle(metin: string, sirlar: string[]): string {
  return sirlar.filter(Boolean).reduce((m, s) => m.split(s).join("***").split(encodeURIComponent(s)).join("***"), metin);
}

/* ---------- Web push aboneliği ---------- */
const PUSH_SUNUCULARI = [/^fcm\.googleapis\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/, /(^|\.)push\.services\.mozilla\.com$/];

export type TemizAbonelik = { endpoint: string; keys: { p256dh: string; auth: string } };

/** Yalnızca bilinen push servislerine (sunucu istek atar: iç ağa yönlendirilemesin), yalnızca gerekli alanlar saklanır */
export function pushAbonelikTemizle(ham: unknown): TemizAbonelik | null {
  const a = ham as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null;
  const { endpoint, keys } = a ?? {};
  const uygun = (s: unknown, n: number): s is string => typeof s === "string" && s.length > 0 && s.length <= n;
  if (!uygun(endpoint, 2048) || !uygun(keys?.p256dh, 512) || !uygun(keys?.auth, 512)) return null;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || (url.port && url.port !== "443") || !PUSH_SUNUCULARI.some((r) => r.test(url.hostname))) return null;
  return { endpoint, keys: { p256dh: keys.p256dh as string, auth: keys.auth as string } };
}

/* ---------- Duyuru ---------- */
type HedefVerisi = { subeler: { id: string }[]; gruplar: { id: string }[] };

export function duyuruEngeli(du: Pick<Duyuru, "baslik" | "metin" | "hedef" | "kanal" | "zamanlanmis" | "zaman">, d: HedefVerisi, simdi: string): Hata {
  if (typeof du.baslik !== "string" || !du.baslik.trim() || typeof du.metin !== "string" || !du.metin.trim()) return "Başlık ve metin zorunlu.";
  if (du.baslik.length > BASLIK_SINIR) return `Başlık en fazla ${BASLIK_SINIR} karakter olabilir.`;
  if (du.metin.length > METIN_SINIR) return `Metin en fazla ${METIN_SINIR} karakter olabilir.`;
  if (du.kanal !== "push" && du.kanal !== "push+sms") return "Geçersiz kanal.";
  const h = du.hedef;
  const hedefTamam =
    h?.tur === "tum" || (h?.tur === "sube" && d.subeler.some((s) => s.id === h.deger)) || (h?.tur === "grup" && d.gruplar.some((g) => g.id === h.deger)) || (h?.tur === "seviye" && /^\d{1,2}$/.test(String(h.deger)));
  if (!hedefTamam) return "Duyuru hedefi geçersiz.";
  if (du.zamanlanmis && !(typeof du.zaman === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(du.zaman) && du.zaman > simdi)) return "Zamanlanan tarih ileri bir an olmalı.";
  return null;
}

/** Ekran: şube personeli yalnızca kendi kapsamındaki zamanlanmış duyuruyu gönderebilir */
export function duyuruKapsamda(du: Pick<Duyuru, "hedef" | "subeIds">, kapsam: string[], grupSube: (id: string) => string | undefined, genel: boolean): boolean {
  if (genel) return true;
  const h = du.hedef;
  if (h.tur === "sube") return kapsam.includes(h.deger ?? "");
  if (h.tur === "grup") return kapsam.includes(grupSube(h.deger ?? "") ?? "");
  return h.tur === "seviye" && !!du.subeIds?.length && du.subeIds.every((s) => kapsam.includes(s));
}
