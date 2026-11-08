/**
 * Bölüm 08 · Ödev takibi: saf iş kuralları.
 * Ekran (index.tsx ve alt dosyalar), sunucu (server/politika.ts · odevDenetle, veliVerisi) ve otomasyon (server/zamanlayici.ts) aynı kuralları kullanır.
 * Sunucu da içe aktardığı için burada yalnızca göreli içe aktarma kullanılır.
 * Hata dönen fonksiyonlar Türkçe mesaj, sorun yoksa null döndürür.
 */
import type { Db, Gonderim, Kayit, Odev, Ogrenci, Rol, TeslimDurumu, Veli } from "../../data/model";
import type { Hata } from "../01-kurum-yapisi/kurallar";
import { satirGecerliMi, tarihGecerli } from "../06-ders-programi/kurallar";
import { yoklamaOgrencileri, yoklamaYoneticisi } from "../07-yoklama/kurallar";
import { tarihEkle } from "../../lib/kurallar";

export const TESLIM_DURUMLARI: TeslimDurumu[] = ["yapti", "eksik", "yapmadi"];
/** Öğretmen kontrolü, yapıldığı tarihten itibaren bu kadar gün düzeltebilir (karar 2026-11-08) */
export const KONTROL_DUZELTME_GUN = 7;
export const BASLIK_UZUNLUK = 200;
export const ACIKLAMA_UZUNLUK = 2000;
export const KAYNAK_UZUNLUK = 500;
export const NOT_UZUNLUK = 300;

export const teslimDurumuGecerli = (s: unknown): s is TeslimDurumu => TESLIM_DURUMLARI.includes(s as TeslimDurumu);
const nesneMi = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const ayni = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/* ---------- Ders ve öğretmen ---------- */

type ProgramVerisi = Pick<Db, "program" | "gruplar">;

/** Grubun bugün veya ileride geçerli program satırları (kapanmış satır ders vermez) */
const gecerliSatirlar = (d: Pick<Db, "program">, grupId: string, bugun: string) => d.program.filter((p) => p.grupId === grupId && (!p.bitis || p.bitis >= bugun));

/** Grubun aldığı dersler. personelId verilirse: öğretmenin ödev verebileceği dersler (yalnızca kendi dersleri; rehberlik ders vermez, karar 2026-11-08). */
export function odevDersleri(d: Pick<Db, "program">, grupId: string, bugun: string, personelId?: string | null): string[] {
  return [...new Set(gecerliSatirlar(d, grupId, bugun).filter((p) => !personelId || p.ogretmenId === personelId).map((p) => p.dersId))];
}

/** Teslim kontrolünü kim yapar: ödevin öğretmeni veya o grubun o dersinde bugün geçerli satırı olan öğretmen (devralan, karar 2026-11-08) */
export function odevKontrolEdebilir(o: Pick<Odev, "ogretmenId" | "grupId" | "dersId">, d: Pick<Db, "program">, personelId: string, bugun: string): boolean {
  return o.ogretmenId === personelId || d.program.some((p) => p.grupId === o.grupId && p.dersId === o.dersId && p.ogretmenId === personelId && satirGecerliMi(p, bugun));
}

/** Yönetici ödev verdiğinde ödevin öğretmeni: o dersin programdaki öğretmeni */
export function odevOgretmeni(d: Pick<Db, "program">, grupId: string, dersId: string, bugun: string): string | null {
  return gecerliSatirlar(d, grupId, bugun).find((p) => p.dersId === dersId)?.ogretmenId ?? null;
}

/* ---------- Hedef öğrenciler ---------- */

type OgrenciVerisi = Pick<Db, "kayitlar" | "ogrenciler">;
type OdevHedefi = Pick<Odev, "grupId" | "ogrenciIds" | "teslim">;

/** Teslim tarihinde grupta olan, kaydı aktif ve ödevin hedefindeki öğrenciler */
export function odevHedefleri(d: OgrenciVerisi, o: OdevHedefi): Ogrenci[] {
  const liste = yoklamaOgrencileri(d, o.grupId, o.teslim);
  return o.ogrenciIds ? liste.filter((x) => o.ogrenciIds!.includes(x.id)) : liste;
}

/** Teslim kontrol listesi: hedefler + durumu işaretlenmiş olup sonradan ayrılanlar (geçmiş kaybolmasın) */
export function odevKontrolListesi(d: OgrenciVerisi, o: OdevHedefi & Pick<Odev, "teslimler">): Ogrenci[] {
  const liste = odevHedefleri(d, o);
  const listede = new Set(liste.map((x) => x.id));
  const ekler = d.ogrenciler.filter((x) => o.teslimler[x.id] && !listede.has(x.id));
  return [...liste, ...ekler].sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
}

/* ---------- Görünürlük ---------- */

/** Öğretmen ekranı: kendi ödevleri, devraldığı dersin ödevleri ve rehberi olduğu grubun ödevleri (rehber yalnızca görür) */
export function ogretmenOdevGorur(o: Pick<Odev, "ogretmenId" | "grupId" | "dersId">, d: ProgramVerisi, personelId: string, bugun: string): boolean {
  return odevKontrolEdebilir(o, d, personelId, bugun) || d.gruplar.some((g) => g.id === o.grupId && g.rehberId === personelId);
}

/** Veliye giden ödevler: yalnızca çocuğunun hedefinde olduğu ödev; teslim durumu ve not yalnızca kendi çocuğunun */
export function veliOdevleri(odevler: Odev[], kayitlar: Pick<Kayit, "ogrenciId" | "grupId" | "durum">[], cocukIds: Set<string>): Odev[] {
  const sonuc: Odev[] = [];
  for (const o of odevler) {
    const ilgili = new Set(kayitlar.filter((k) => cocukIds.has(k.ogrenciId) && k.grupId === o.grupId && k.durum !== "iptal" && (!o.ogrenciIds || o.ogrenciIds.includes(k.ogrenciId))).map((k) => k.ogrenciId));
    if (!ilgili.size) continue;
    sonuc.push({
      ...o,
      teslimler: Object.fromEntries(Object.entries(o.teslimler).filter(([x]) => ilgili.has(x))),
      notlar: Object.fromEntries(Object.entries(o.notlar).filter(([x]) => ilgili.has(x))),
      ogrenciIds: o.ogrenciIds ? o.ogrenciIds.filter((x) => ilgili.has(x)) : null,
    });
  }
  return sonuc;
}

/* ---------- Yazma denetimi ---------- */

export type OdevBaglami = { rol: Rol; personelId: string; bugun: string; modulAcik: boolean; ogretmenGruplari: Set<string> | null };
type YazmaVerisi = ProgramVerisi & OgrenciVerisi & Pick<Db, "dersler">;

/** Teslim tarihi gelmemiş ödevin kontrolü kaydedilemez ("yapmadı" bildirimi yanlış gider) */
export function kontrolZamanEngeli(teslim: string, bugun: string): Hata {
  return teslim > bugun ? "Teslim tarihi gelmeden teslim kontrolü yapılamaz." : null;
}

/** Yapılmış kontrolü öğretmen 7 gün düzeltir, sonrası yönetici. Eski kayıtta kontrol tarihi yoksa teslim tarihi esas alınır. */
export function kontrolDuzeltmeEngeli(o: Pick<Odev, "kontrolEdildi" | "kontrolTarihi" | "teslim">, rol: Rol, bugun: string): Hata {
  if (!o.kontrolEdildi || yoklamaYoneticisi(rol)) return null;
  return bugun > tarihEkle(o.kontrolTarihi ?? o.teslim, KONTROL_DUZELTME_GUN) ? `Kontrol ${KONTROL_DUZELTME_GUN} günden eski; yalnızca yönetici düzeltebilir.` : null;
}

function metinEngeli(s: Odev, eski: Odev | undefined): Hata {
  if (typeof s.baslik !== "string" || !s.baslik.trim()) return "Ödev başlığı boş olamaz.";
  if (typeof s.aciklama !== "string" || typeof s.kaynak !== "string") return "Ödev bilgileri hatalı.";
  if (s.baslik !== eski?.baslik && s.baslik.trim().length > BASLIK_UZUNLUK) return `Başlık en fazla ${BASLIK_UZUNLUK} karakter olabilir.`;
  if (s.aciklama !== eski?.aciklama && s.aciklama.trim().length > ACIKLAMA_UZUNLUK) return `Açıklama en fazla ${ACIKLAMA_UZUNLUK} karakter olabilir.`;
  if (s.kaynak !== eski?.kaynak && s.kaynak.trim().length > KAYNAK_UZUNLUK) return `Kaynak en fazla ${KAYNAK_UZUNLUK} karakter olabilir.`;
  return null;
}

function dersEngeli(s: Odev, d: YazmaVerisi, b: OdevBaglami): Hata {
  if (!d.dersler.some((x) => x.id === s.dersId)) return "Ders bulunamadı.";
  if (!odevDersleri(d, s.grupId, b.bugun).includes(s.dersId)) return "Bu grup bu dersi almıyor.";
  if (b.rol === "ogretmen" && !odevDersleri(d, s.grupId, b.bugun, b.personelId).includes(s.dersId)) return "Yalnızca kendi dersinizden ödev verebilirsiniz.";
  return null;
}

function teslimEngeli(s: Odev, eski: Odev, d: YazmaVerisi, b: OdevBaglami): Hata {
  if (!nesneMi(s.teslimler) || !nesneMi(s.notlar)) return "Teslim durumları hatalı.";
  if (eski.kontrolEdildi && s.kontrolEdildi !== true) return "Yapılmış teslim kontrolü geri alınamaz.";
  if (ayni(s.teslimler, eski.teslimler) && ayni(s.notlar, eski.notlar) && s.kontrolEdildi === eski.kontrolEdildi) return null;
  if (s.kontrolEdildi !== true) return "Teslim durumu kontrolle birlikte kaydedilir.";
  const zaman = kontrolZamanEngeli(s.teslim, b.bugun) ?? kontrolDuzeltmeEngeli(eski, b.rol, b.bugun);
  if (zaman) return zaman;
  const hedef = new Set(odevHedefleri(d, s).map((x) => x.id));
  const girdiler = Object.entries(s.teslimler);
  for (const [id, durum] of girdiler) {
    if (!teslimDurumuGecerli(durum)) return "Geçersiz teslim durumu.";
    if (!hedef.has(id) && !eski.teslimler[id]) return "Bu ödevin hedefinde olmayan öğrenci var.";
  }
  if (hedef.size > 0 && girdiler.length === 0 && !Object.keys(eski.teslimler).length) return "Teslim kontrolünde öğrenci yok.";
  for (const [id, not] of Object.entries(s.notlar)) {
    if (typeof not !== "string" || not.trim().length > NOT_UZUNLUK) return `Geri bildirim en fazla ${NOT_UZUNLUK} karakter olabilir.`;
    if (s.teslimler[id] === undefined && !eski.teslimler[id]) return "Geri bildirim yalnızca teslim durumu olan öğrenciye yazılır.";
  }
  return null;
}

/** Devralan öğretmenin değiştiremeyeceği alanlar */
const KONTROL_DISI_ALANLAR = ["ogretmenId", "dersId", "grupId", "ogrenciIds", "baslik", "aciklama", "kaynak", "verilis", "teslim"] as const;

export function odevYazmaEngeli(s: Odev, eski: Odev | undefined, d: YazmaVerisi, b: OdevBaglami): Hata {
  if (!b.modulAcik) return "Ödev modülü kapalı.";
  if (b.ogretmenGruplari) {
    if (!b.ogretmenGruplari.has(s.grupId)) return "Yalnızca kendi gruplarınızın ödevlerini yazabilirsiniz.";
    if (eski && eski.ogretmenId !== b.personelId) {
      if (!odevKontrolEdebilir(eski, d, b.personelId, b.bugun)) return "Yalnızca kendi ödevlerinizi değiştirebilirsiniz.";
      if (KONTROL_DISI_ALANLAR.some((a) => !ayni(s[a], eski[a]))) return "Devraldığınız ödevde yalnızca teslim kontrolü yapabilirsiniz.";
    }
  }
  if (eski && eski.grupId !== s.grupId) return "Ödevin grubu değiştirilemez.";
  if (!d.gruplar.some((g) => g.id === s.grupId)) return "Grup bulunamadı.";
  const metin = metinEngeli(s, eski);
  if (metin) return metin;
  if (!eski || eski.dersId !== s.dersId) {
    const ders = dersEngeli(s, d, b);
    if (ders) return ders;
  }
  if (!eski || eski.teslim !== s.teslim) {
    if (!tarihGecerli(s.teslim)) return "Geçersiz teslim tarihi.";
    if (s.teslim < (eski?.verilis ?? b.bugun)) return "Teslim tarihi verilme tarihinden önce olamaz.";
  }
  if (!eski || !ayni(eski.ogrenciIds, s.ogrenciIds)) {
    if (s.ogrenciIds !== null && (!Array.isArray(s.ogrenciIds) || s.ogrenciIds.length === 0)) return "Ödevin hedef öğrencileri seçilmeli.";
    if (s.ogrenciIds) {
      const hedef = new Set(odevHedefleri(d, { ...s, ogrenciIds: null }).map((x) => x.id));
      if (s.ogrenciIds.some((x) => !hedef.has(x))) return "Seçilen öğrenciler bu grupta olmalı.";
    }
  }
  return eski ? teslimEngeli(s, eski, d, b) : null;
}

export function odevSilmeEngeli(eski: Odev, b: OdevBaglami): Hata {
  if (!b.modulAcik) return "Ödev modülü kapalı.";
  if (!b.ogretmenGruplari) return null;
  if (!b.ogretmenGruplari.has(eski.grupId) || eski.ogretmenId !== b.personelId) return "Yalnızca kendi ödevlerinizi silebilirsiniz.";
  return eski.kontrolEdildi ? "Teslim kontrolü yapılmış ödevi yalnızca yönetici silebilir." : null;
}

/** "Yaptı" işaretli öğrenciye not kalmaz; boş not saklanmaz; durumu olmayana not yazılmaz */
export function notlarTemizle(notlar: Record<string, string>, durumlar: Record<string, TeslimDurumu>): Record<string, string> {
  const sonuc: Record<string, string> = {};
  for (const [id, not] of Object.entries(notlar)) {
    const t = String(not ?? "").trim();
    if (t && durumlar[id] && durumlar[id] !== "yapti") sonuc[id] = t;
  }
  return sonuc;
}

/** Sunucunun yazdığı son hal: öğretmen, veriliş ve kontrol alanları istemciye bırakılmaz; ayrılan öğrencinin kaydı silinmez */
export function odevTemizle(s: Odev, eski: Odev | undefined, ogretmenId: string, bugun: string): Odev {
  const { kontrolTarihi: _istemci, ...temel } = s;
  void _istemci;
  const metinler = { baslik: s.baslik.trim(), aciklama: s.aciklama.trim(), kaynak: s.kaynak.trim() };
  if (!eski) return { ...temel, ...metinler, ogretmenId, verilis: bugun, teslimler: {}, notlar: {}, kontrolEdildi: false };
  // İlk kontrolün tarihi sabittir; düzeltme süreyi uzatmaz
  const kontrolTarihi = eski.kontrolTarihi ?? (!eski.kontrolEdildi && s.kontrolEdildi ? bugun : undefined);
  const teslimler = { ...eski.teslimler, ...s.teslimler };
  const korunan = Object.fromEntries(Object.entries(eski.notlar).filter(([id]) => s.teslimler[id] === undefined));
  return { ...temel, ...metinler, ogretmenId: eski.ogretmenId, verilis: eski.verilis, teslimler, notlar: notlarTemizle({ ...korunan, ...s.notlar }, teslimler), ...(kontrolTarihi ? { kontrolTarihi } : {}) };
}

/* ---------- Bildirim ---------- */

export type OdevOlayi = "yeniOdev" | "odevYapmadi" | "odevHatirlatma" | "odevDuzeltme";
export const odevBildirimiMi = (olay: unknown): olay is OdevOlayi => olay === "yeniOdev" || olay === "odevYapmadi" || olay === "odevHatirlatma" || olay === "odevDuzeltme";

/** "Yapmadı" bildirimleri. Ödev kimliği yazılmadan önceki kayıtlar başlıkla eşleşir. */
export function yapmadiBildirimleri<T extends Pick<Gonderim, "olay" | "ogrenciId" | "metin" | "odevId">>(gonderimler: T[], o: Pick<Odev, "id" | "baslik">, ogrenciId: string): T[] {
  return gonderimler.filter((g) => g.olay === "odevYapmadi" && g.ogrenciId === ogrenciId && (g.odevId === o.id || (!g.odevId && g.metin.includes(o.baslik))));
}

/** Bu kayıtla yeni "yapmadı" olanlar */
export function yeniYapmayanlar(yeni: Record<string, TeslimDurumu>, eski: Record<string, TeslimDurumu>): string[] {
  return Object.entries(yeni).filter(([id, s]) => s === "yapmadi" && eski[id] !== "yapmadi").map(([id]) => id);
}

type BildirimAlani = Pick<Gonderim, "olay" | "veliId" | "ogrenciId" | "metin" | "odevId">;

/** Aynı veliye aynı ödev için aynı olay ikinci kez gitmez. Ödev kimliği yazılmadan önceki kayıtlar metinle eşleşir. */
export function odevBildirimiYineleniyor(g: BildirimAlani, odevId: string, onceki: BildirimAlani[]): boolean {
  return onceki.some((x) => x.olay === g.olay && x.veliId === g.veliId && x.ogrenciId === g.ogrenciId && (x.odevId === odevId || (!x.odevId && x.metin === g.metin)));
}

/** Veli SMS iznini kapattıysa SMS gitmez: kanal uygulama içine döner, maliyet sıfırlanır */
export function smsIzniUygula(g: Pick<Gonderim, "kanal" | "veliId" | "maliyet">, veliler: Pick<Veli, "id" | "izinSms">[]): void {
  if (g.kanal === "sms" && veliler.find((v) => v.id === g.veliId)?.izinSms === false) {
    g.kanal = "push";
    g.maliyet = 0;
  }
}

/* ---------- Oranlar ---------- */

export type TeslimOzeti = { verilen: number; kontrol: number; oran: number | null; eksik: number; yapmadi: number };

/** Tam teslim oranı: yalnızca kontrol edilmiş ödevlerde, işaretlenen öğrenciler üzerinden. Kontrol yoksa oran yok (null). */
export function teslimOzeti(liste: Pick<Odev, "kontrolEdildi" | "teslimler">[]): TeslimOzeti {
  const kontrollu = liste.filter((o) => o.kontrolEdildi);
  const t = kontrollu.flatMap((o) => Object.values(o.teslimler));
  const say = (s: TeslimDurumu) => t.filter((x) => x === s).length;
  return { verilen: liste.length, kontrol: kontrollu.length, oran: t.length ? say("yapti") / t.length : null, eksik: say("eksik"), yapmadi: say("yapmadi") };
}
