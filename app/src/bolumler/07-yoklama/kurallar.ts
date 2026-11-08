/**
 * Bölüm 07 · Yoklama ve devamsızlık: saf iş kuralları.
 * Ekran (index.tsx ve alt dosyalar) ve sunucu (server/politika.ts · yoklamaDenetle, server/uygulama.ts · /api/veli/izin) aynı kuralları kullanır.
 * Sunucu da içe aktardığı için burada yalnızca göreli içe aktarma kullanılır.
 * Hata dönen fonksiyonlar Türkçe mesaj, sorun yoksa null döndürür.
 */
import type { Db, Gonderim, Iptal, Kayit, Ogrenci, Oturum, ProgramSatiri, Rol, Tatil, Yoklama } from "../../data/model";
import { dakika, haftaBasi, haftaGunu, tarihEkle, yoklamaGecikti, type YoklamaDurumu } from "../../lib/kurallar";
import type { Hata } from "../01-kurum-yapisi/kurallar";
import { oturumKimligi, satirGecerliMi, tarihGecerli } from "../06-ders-programi/kurallar";

export const YOKLAMA_DURUMLARI: YoklamaDurumu[] = ["geldi", "gelmedi", "gec", "izinli"];
export const KONU_UZUNLUK = 200;
/** Yönetici dışındakiler alınmamış yoklamayı en fazla bu kadar gün sonra girebilir (ekrandaki "son 7 gün" uyarısıyla aynı) */
export const GEC_YOKLAMA_GUN = 7;
/** Veli en fazla bu kadar gün sonrası için izin bildirir */
export const IZIN_UFUK_GUN = 60;

export const durumGecerli = (s: unknown): s is YoklamaDurumu => YOKLAMA_DURUMLARI.includes(s as YoklamaDurumu);

/** Geçmiş günün yoklamasını düzeltebilenler (doküman: aynı gün öğretmen, sonrasında yalnızca yönetici) */
export const yoklamaYoneticisi = (rol: Rol) => rol === "genel-yonetici" || rol === "sube-muduru";

/* ---------- Oturumun gerçekliği ---------- */

export type OturumGercegi = { satir: ProgramSatiri; tarih: string; bas: string; bit: string; subeId: string; iptal: Iptal | null; tatil: Tatil | null };
type OturumVerisi = Pick<Db, "program" | "gruplar" | "dersSaatleri" | "sezonlar" | "iptaller" | "tatiller">;

/** Kimlik gerçek bir oturuma karşılık geliyor mu: satır var, gün tutuyor, satır yürürlükte, sezon içinde */
export function yoklamaOturumu(d: OturumVerisi, oturumId: unknown): OturumGercegi | null {
  const k = oturumKimligi(oturumId);
  if (!k) return null;
  const satir = d.program.find((p) => p.id === k.satirId);
  if (!satir || satir.gun !== haftaGunu(k.tarih) || !satirGecerliMi(satir, k.tarih)) return null;
  const g = d.gruplar.find((x) => x.id === satir.grupId);
  const h = d.dersSaatleri.find((x) => x.id === satir.saatId);
  if (!g || !h) return null;
  const sezon = d.sezonlar.find((z) => z.id === g.sezonId);
  if (sezon && k.tarih > sezon.bitis) return null;
  return {
    satir, tarih: k.tarih, bas: h.baslangic, bit: h.bitis, subeId: g.subeId,
    iptal: d.iptaller.find((i) => i.oturumId === oturumId) ?? null,
    tatil: d.tatiller.find((t) => t.tarih === k.tarih && (!t.subeId || t.subeId === g.subeId)) ?? null,
  };
}

/* ---------- Yoklamadaki öğrenciler ---------- */

/** Kaydın o tarihteki grubu (grup geçmişinden). Kayıt henüz başlamadıysa null. */
export function kayitGrubu(k: Pick<Kayit, "grupId" | "tarih" | "grupGecmisi">, tarih: string): string | null {
  const gecmis = k.grupGecmisi ?? [];
  if (!gecmis.length) return k.tarih <= tarih ? k.grupId : null;
  let grup: string | null = null;
  for (const g of gecmis) if (g.tarih <= tarih) grup = g.grupId; // aynı gün iki değişiklikte sonuncusu geçerli
  return grup;
}

/** O tarihte bu grupta olan ve kaydı aktif öğrenciler. Dondurulmuş, iptal, mezun ve başka gruba geçmiş olanlar girmez. */
export function yoklamaOgrencileri(d: Pick<Db, "kayitlar" | "ogrenciler">, grupId: string, tarih: string): Ogrenci[] {
  const ids = new Set(d.kayitlar.filter((k) => k.durum === "aktif" && kayitGrubu(k, tarih) === grupId).map((k) => k.ogrenciId));
  return d.ogrenciler.filter((o) => ids.has(o.id)).sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
}

/** Yoklama ekranındaki liste: o tarihteki öğrenciler + yoklamada kayıtlı olup sonradan ayrılanlar (geçmiş kaybolmasın) */
export function yoklamaListesi(d: Pick<Db, "kayitlar" | "ogrenciler">, grupId: string, tarih: string, eski?: Pick<Yoklama, "durumlar">): Ogrenci[] {
  const liste = yoklamaOgrencileri(d, grupId, tarih);
  const listede = new Set(liste.map((o) => o.id));
  const ekler = d.ogrenciler.filter((o) => eski?.durumlar[o.id] && !listede.has(o.id));
  return [...liste, ...ekler].sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
}

/** İlk durumlar: kayıtlı durum, yoksa veli izni varsa izinli, yoksa geldi */
export function ilkDurumlar(ogrenciIds: string[], izinliler: Set<string>, eski?: Pick<Yoklama, "durumlar">): Record<string, YoklamaDurumu> {
  return Object.fromEntries(ogrenciIds.map((id) => [id, eski?.durumlar[id] ?? (izinliler.has(id) ? "izinli" : "geldi")]));
}

/* ---------- Kim, ne zaman ---------- */

export type ZamanGirdisi = { tarih: string; bas: string; kayitVar: boolean; rol: Rol; bugun: string; simdi: string };

/** Ekran ve sunucu aynı mesajı verir */
export function yoklamaZamanEngeli({ tarih, bas, kayitVar, rol, bugun, simdi }: ZamanGirdisi): Hata {
  if (tarih > bugun) return "Gelecek tarihli dersin yoklaması alınamaz.";
  if (tarih === bugun && dakika(simdi) < dakika(bas)) return "Ders başlamadan yoklama alınamaz.";
  if (tarih === bugun || yoklamaYoneticisi(rol)) return null;
  if (kayitVar) return "Geçmiş günün yoklamasını yalnızca yönetici düzeltebilir.";
  if (tarih < tarihEkle(bugun, -GEC_YOKLAMA_GUN)) return `${GEC_YOKLAMA_GUN} günden eski dersin yoklamasını yalnızca yönetici girebilir.`;
  return null;
}

export type YazmaBaglami = { rol: Rol; personelId: string; bugun: string; simdi: string };
type YazmaVerisi = OturumVerisi & Pick<Db, "kayitlar" | "ogrenciler">;

export function yoklamaYazmaEngeli(y: Yoklama, eski: Yoklama | undefined, d: YazmaVerisi, b: YazmaBaglami): Hata {
  const k = oturumKimligi(y.oturumId);
  if (!k || y.tarih !== k.tarih || y.satirId !== k.satirId) return "Yoklama oturumu hatalı.";
  const o = yoklamaOturumu(d, y.oturumId);
  if (!o) return "Bu tarihte böyle bir ders yok.";
  if (y.grupId !== o.satir.grupId) return "Yoklama oturumu hatalı.";
  if (b.rol === "ogretmen" && o.satir.ogretmenId !== b.personelId) return "Yalnızca kendi dersinizin yoklamasını alabilirsiniz.";
  // Yoklaması alınmış derse sonradan tatil / iptal eklenemez (Bölüm 06); yalnızca ilk kayıt denetlenir, eski kayıt düzeltilebilir kalır
  if (!eski && o.tatil) return "Bu tarih tatil; yoklama alınamaz.";
  if (!eski && o.iptal) return "İptal edilen dersin yoklaması alınamaz.";
  const zaman = yoklamaZamanEngeli({ tarih: k.tarih, bas: o.bas, kayitVar: !!eski, rol: b.rol, bugun: b.bugun, simdi: b.simdi });
  if (zaman) return zaman;
  if (!y.durumlar || typeof y.durumlar !== "object" || Array.isArray(y.durumlar)) return "Yoklama durumları hatalı.";
  const girdiler = Object.entries(y.durumlar);
  const uygun = new Set(yoklamaOgrencileri(d, y.grupId, k.tarih).map((x) => x.id));
  for (const [id, s] of girdiler) {
    if (!durumGecerli(s)) return "Geçersiz yoklama durumu.";
    if (!uygun.has(id) && !eski?.durumlar[id]) return "Yoklamada bu derste kaydı olmayan öğrenci var.";
  }
  if (!eski && uygun.size > 0 && girdiler.length === 0) return "Yoklamada öğrenci yok.";
  if (typeof y.konu !== "string" || y.konu.length > KONU_UZUNLUK) return `Konu en fazla ${KONU_UZUNLUK} karakter olabilir.`;
  return null;
}

/* ---------- Bildirim ---------- */

/** Bu kayıtla yeni "gelmedi" olanlar (düzeltmede zaten gelmedi olana tekrar sayılmaz) */
export function yeniGelmeyenler(yeni: Record<string, YoklamaDurumu>, eski?: Record<string, YoklamaDurumu>): string[] {
  return Object.entries(yeni).filter(([id, s]) => s === "gelmedi" && eski?.[id] !== "gelmedi").map(([id]) => id);
}

/** Şablon "bugün ... katılmadı" der: yalnızca dersin gününde girilen devamsızlık veliye anında bildirilir */
export const anindaBildirilir = (tarih: string, bugun: string) => tarih === bugun;

type BildirimAlani = Pick<Gonderim, "olay" | "veliId" | "ogrenciId" | "metin" | "zaman">;

/** Aynı veliye aynı gün aynı devamsızlık metni daha önce kuyruğa girdiyse tekrar gönderilmez (gelmedi → geldi → gelmedi, iki cihazdan kayıt) */
export function devamsizlikYineleniyor(g: BildirimAlani, onceki: BildirimAlani[]): boolean {
  return g.olay === "devamsizlik" && onceki.some((x) => x.olay === "devamsizlik" && x.veliId === g.veliId && x.ogrenciId === g.ogrenciId && x.metin === g.metin && x.zaman.slice(0, 10) === g.zaman.slice(0, 10));
}

/* ---------- Veli izni ---------- */

export type IzinGirdisi = { ogrenciId: string; tarih: unknown };

export function izinEngeli(g: IzinGirdisi, d: Pick<Db, "izinler" | "kayitlar">, bugun: string): Hata {
  if (!tarihGecerli(g.tarih) || g.tarih < bugun || g.tarih > tarihEkle(bugun, IZIN_UFUK_GUN)) return "Geçersiz tarih.";
  if (!d.kayitlar.some((k) => k.ogrenciId === g.ogrenciId && k.durum === "aktif")) return "Öğrencinin aktif kaydı yok.";
  if (d.izinler.some((i) => i.ogrenciId === g.ogrenciId && i.tarih === g.tarih)) return "Bu tarih için izin zaten bildirilmiş.";
  return null;
}

/* ---------- Ekran ---------- */

export type OturumDurumu = "alindi" | "gecikti" | "devam" | "planli" | "iptal";

export function oturumDurumu(o: Pick<Oturum, "tarih" | "bas" | "iptal" | "tatil">, alindi: boolean, bugun: string, simdi: string, esikDk: number): OturumDurumu {
  if (o.iptal || o.tatil) return "iptal";
  if (alindi) return "alindi";
  if (o.tarih < bugun) return "gecikti";
  if (o.tarih > bugun) return "planli";
  if (yoklamaGecikti(o.bas, simdi, esikDk)) return "gecikti";
  return simdi >= o.bas ? "devam" : "planli";
}

export type RaporDonemi = "hafta" | "ay" | "sezon";

/** Rapor başlangıcı; sezon tanımı yoksa ay başı */
export function raporBaslangici(donem: RaporDonemi, bugun: string, sezonBaslangic?: string): string {
  if (donem === "hafta") return haftaBasi(bugun);
  if (donem === "sezon" && sezonBaslangic) return sezonBaslangic;
  return `${bugun.slice(0, 8)}01`;
}
