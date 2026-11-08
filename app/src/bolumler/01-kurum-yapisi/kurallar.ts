/**
 * Bölüm 01 · Kurum yapısı ve tanımlar — saf iş kuralları.
 * Arayüzden ve sunucudan bağımsızdır: hem ekran (anında geri bildirim) hem sunucu (politika.ts, son söz)
 * aynı fonksiyonları kullanır. Bu yüzden yalnızca göreli içe aktarma ve tip içe aktarması yapılır.
 * Testler: kurallar.test.ts
 */
import type { Db, Derslik, DersSaati, FiyatSatiri, Grup, Kayit, Kurum, ProgramSatiri, Sezon, Sube, Ders } from "../../data/model";
import { dakika, epostaGecerli, normalAd, sozlesmeNo } from "../../lib/kurallar";

/** Doğrulama sonucu: null = geçerli, metin = kullanıcıya gösterilecek ilk hata */
export type Hata = string | null;

export const SEVIYELER = [3, 4, 5, 6, 7, 8] as const;
export const EN_DUSUK_SEVIYE = 3;
export const EN_YUKSEK_SEVIYE = 8;
/** Grup/derslik kapasitesi üst sınırı (yanlış yazımı yakalamak için) */
export const EN_BUYUK_KAPASITE = 500;
/** Logo veri adresinin (base64) en fazla uzunluğu: 200 KB dosya ≈ 273 KB base64 */
export const LOGO_EN_FAZLA_BAYT = 200 * 1024;
const LOGO_EN_FAZLA_KARAKTER = Math.ceil((LOGO_EN_FAZLA_BAYT * 4) / 3) + 64;

const bos = (s: unknown) => typeof s !== "string" || s.trim() === "";
const ayniAd = (a: string, b: string) => normalAd(a) === normalAd(b);
const isoTarihMi = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s + "T00:00:00").getTime());

/* ---------- Aktif / pasif tanım ---------- */

/** Derslik ve ders saati: `aktif` alanı yoksa (eski veri, yedek) aktif sayılır. */
export function tanimAktif(x: { aktif?: boolean } | null | undefined): boolean {
  return !!x && x.aktif !== false;
}

/**
 * Seçim listesi için: aktif kayıtlar ve (pasif olsa bile) şu an seçili olan kayıt.
 * Pasif kayıt yeni atamada seçilemez ama mevcut atama görünür kalmalı.
 */
export function secilebilirTanimlar<T extends { id: string; aktif?: boolean }>(liste: T[], seciliId?: string): T[] {
  return liste.filter((x) => tanimAktif(x) || x.id === seciliId);
}

/** Seçeneğin sonuna pasif kayıtlarda " (pasif)" eki */
export function pasifEki(x: { aktif?: boolean }): string {
  return tanimAktif(x) ? "" : " (pasif)";
}

const aktiflikGecersiz = (a: unknown) => a !== undefined && typeof a !== "boolean";

/* ---------- Ortak sayısal kurallar ---------- */

/** Kapasite pozitif tam sayı olmalı (1 … 500) */
export function kapasiteGecerli(n: unknown): boolean {
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= EN_BUYUK_KAPASITE;
}

/** Ekrandaki sayı kutusundan gelen değeri geçerli kapasiteye çevirir (boş/eksi/ondalık → en yakın geçerli) */
export function kapasiteDuzelt(girdi: string | number): number {
  const n = Math.floor(Number(girdi));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, EN_BUYUK_KAPASITE);
}

/** Liste fiyatı: sonlu, negatif olmayan sayı */
export function fiyatGecerli(n: unknown): boolean {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

/* ---------- Kurum ---------- */
export function kurumDogrula(k: Partial<Kurum> | null | undefined): Hata {
  if (!k || typeof k !== "object") return "Kurum bilgileri eksik.";
  if (bos(k.ad)) return "Kurum adı boş olamaz.";
  if (!bos(k.eposta) && !epostaGecerli(String(k.eposta).trim())) return "E-posta adresi geçersiz.";
  if (k.vergiNo && !/^\d{10,11}$/.test(String(k.vergiNo).replace(/\s/g, ""))) return "Vergi no 10 haneli (TC kimlik no ise 11 haneli) olmalı.";
  if (k.logo !== undefined && k.logo !== null && k.logo !== "") {
    if (typeof k.logo !== "string" || !/^data:image\/(png|jpeg|svg\+xml);base64,/.test(k.logo)) return "Logo PNG, JPEG veya SVG olmalı.";
    if (k.logo.length > LOGO_EN_FAZLA_KARAKTER) return "Logo en fazla 200 KB olmalı.";
  }
  return null;
}

/* ---------- Şube ---------- */
export const SUBE_KODU_DESENI = /^[A-ZÇĞİÖŞÜ]{2,5}$/;

export function subeKoduNormalize(kod: string): string {
  return String(kod ?? "").trim().toLocaleUpperCase("tr-TR");
}

/** Şube adı ve kısa kodu: dolu, kod 2–5 harf, ikisi de kurum içinde benzersiz */
export function subeDogrula(f: { id?: string; ad: string; kod: string }, mevcut: Sube[]): Hata {
  if (bos(f.ad)) return "Şube adı boş olamaz.";
  const kod = subeKoduNormalize(f.kod);
  if (!SUBE_KODU_DESENI.test(kod)) return "Kısa kod 2–5 harf olmalı (rakam ve boşluk olmadan).";
  const digerleri = mevcut.filter((s) => s.id !== f.id);
  if (digerleri.some((s) => subeKoduNormalize(s.kod) === kod)) return "Bu kısa kod başka bir şubede kullanılıyor.";
  if (digerleri.some((s) => ayniAd(s.ad, f.ad))) return "Bu adla bir şube zaten var.";
  return null;
}

/**
 * Aktif sezonda aktif veya dondurulmuş kaydı olan şube pasife alınamaz; önce öğrenciler nakledilir.
 * Geçmiş sezon kayıtları engel değildir (sezon geçişinden sonra eski kayıtlar "aktif" kalır).
 */
export function subePasifeAlmaEngeli(subeId: string, kayitlar: Pick<Kayit, "subeId" | "sezonId" | "durum">[], aktifSezonId: string | undefined): Hata {
  const n = kayitlar.filter((k) => k.subeId === subeId && k.sezonId === aktifSezonId && k.durum !== "iptal").length;
  return n > 0 ? `Bu şubede ${n} aktif/dondurulmuş kayıt var. Pasife almadan önce öğrencileri nakledin.` : null;
}

/** Yeni şube sihirbazı: kaynak şubenin derslik ve ders saatlerini yeni şubeye kopyalar (yeni kimliklerle). */
export function subeKopyasi(
  kaynakId: string,
  yeniSubeId: string,
  d: Pick<Db, "derslikler" | "dersSaatleri">,
  secim: { derslik: boolean; saat: boolean },
  yeniId: (onek: string) => string,
): { derslikler: Derslik[]; dersSaatleri: DersSaati[] } {
  return {
    derslikler: secim.derslik ? d.derslikler.filter((x) => x.subeId === kaynakId).map((x) => ({ ...x, id: yeniId("d"), subeId: yeniSubeId })) : [],
    dersSaatleri: secim.saat ? d.dersSaatleri.filter((x) => x.subeId === kaynakId).map((x) => ({ ...x, id: yeniId("h"), subeId: yeniSubeId })) : [],
  };
}

/* ---------- Sezon ---------- */
export function sezonDogrula(f: { id?: string; ad: string; baslangic: string; bitis: string }, mevcut: Sezon[]): Hata {
  if (bos(f.ad)) return "Sezon adı boş olamaz.";
  if (!isoTarihMi(f.baslangic) || !isoTarihMi(f.bitis)) return "Başlangıç ve bitiş tarihi seçilmeli.";
  if (f.bitis <= f.baslangic) return "Bitiş tarihi başlangıçtan sonra olmalı.";
  if (mevcut.some((s) => s.id !== f.id && ayniAd(s.ad, f.ad))) return "Bu adla bir sezon zaten var.";
  return null;
}

/** Aynı anda tam olarak bir aktif sezon olur. */
export function aktifSezonDenetle(sezonlar: Pick<Sezon, "aktif">[]): Hata {
  const n = sezonlar.filter((s) => s.aktif).length;
  if (n === 0) return "Bir aktif sezon seçili olmalı.";
  if (n > 1) return "Aynı anda yalnızca bir aktif sezon olabilir.";
  return null;
}

/** "5-A" → "6-A". Ad seviye ile başlamıyorsa değişmez. */
export function grupAdiGecisi(ad: string, yeniSeviye: number): string {
  return ad.replace(/^\d+/, String(yeniSeviye));
}

/** Kaynak sezondan sonra başlayan sezonlar geçiş hedefi olabilir. */
export function sezonGecisHedefleri(sezonlar: Sezon[], kaynak: Sezon): Sezon[] {
  return sezonlar.filter((s) => s.id !== kaynak.id && s.baslangic > kaynak.baslangic);
}

export type SezonGecisSonucu = {
  gruplar: Grup[];
  kayitlar: Kayit[];
  /** 8. sınıf grupları kopyalanmaz (mezun) */
  mezunGrupSayisi: number;
  /** En üst seviye gruplardaki aktif / dondurulmuş kayıtların "mezun" hali (karar 2026-11-07, Bölüm 04) */
  mezunlar: Kayit[];
};

/**
 * Yeni sezona geçiş: kaynak sezonun 3–7. sınıf grupları seviyesi bir artırılarak hedef sezona kopyalanır.
 * ogrenciTasi ise aktif kayıtlar yeni gruplara yeni kayıt olarak açılır:
 * yeni sözleşme numarası (hedef sezonun yılı), KVKK onayı yeniden alınmak üzere boş, içe aktarma bağı yok.
 * En üst seviyedeki (8. sınıf) grupların aktif / dondurulmuş kayıtları öğrenci taşınsın taşınmasın "mezun" olur.
 */
/** Taşınacak (aktif, 8. sınıf olmayan) kayıtların hedef sezondaki şube + seviyesi */
function tasinacakYerler(d: Pick<Db, "gruplar" | "kayitlar">, kaynakId: string): { subeId: string; seviye: number }[] {
  const gruplar = new Map(d.gruplar.filter((g) => g.sezonId === kaynakId && g.seviye < EN_YUKSEK_SEVIYE).map((g) => [g.id, g]));
  const yerler = new Map<string, { subeId: string; seviye: number }>();
  for (const k of d.kayitlar) {
    const g = gruplar.get(k.grupId);
    if (k.sezonId !== kaynakId || k.durum !== "aktif" || !g) continue;
    yerler.set(`${k.subeId}|${g.seviye + 1}`, { subeId: k.subeId, seviye: g.seviye + 1 });
  }
  return [...yerler.values()].sort((a, b) => a.subeId.localeCompare(b.subeId) || a.seviye - b.seviye);
}

/**
 * Sezon geçişinde fiyat (karar 2026-11-07): eski kaydın fiyatı, indirimi ve ek hizmeti kopyalanmaz, hedef sezonun
 * fiyat listesindeki fiyat uygulanır. Finans açıkken taşınacak bir şube + seviye için hedef sezonda fiyat
 * tanımlı değilse geçiş başlamaz (fiyatsız kayıt açılmaz); önce Fiyat listesi sekmesinden fiyat girilir.
 */
export function sezonGecisFiyatEksikleri(d: Pick<Db, "gruplar" | "kayitlar" | "fiyatListesi">, kaynakId: string, hedefId: string): { subeId: string; seviye: number }[] {
  return tasinacakYerler(d, kaynakId).filter((y) => fiyatBul(d.fiyatListesi, hedefId, y.subeId, y.seviye) === null);
}
export function sezonGecisFiyatEngeli(
  d: Pick<Db, "gruplar" | "kayitlar" | "fiyatListesi" | "moduller" | "subeler">,
  kaynakId: string | undefined,
  hedefId: string,
  ogrenciTasi: boolean,
): Hata {
  if (!kaynakId || !hedefId || !ogrenciTasi || d.moduller?.finans !== true) return null;
  const eksik = sezonGecisFiyatEksikleri(d, kaynakId, hedefId);
  if (!eksik.length) return null;
  const ad = (id: string) => d.subeler.find((s) => s.id === id)?.kod ?? id;
  return `Hedef sezonda fiyatı tanımlı olmayan şube/seviye var: ${eksik.map((y) => `${ad(y.subeId)} ${y.seviye}. sınıf`).join(", ")}. Önce Fiyat listesi sekmesinden fiyat girin.`;
}

export function sezonGecisiPlani(
  d: Pick<Db, "gruplar" | "kayitlar" | "subeler" | "sezonlar" | "personel" | "fiyatListesi" | "moduller">,
  kaynakId: string,
  hedefId: string,
  ogrenciTasi: boolean,
  yeniId: (onek: string) => string,
): SezonGecisSonucu {
  const hedef = d.sezonlar.find((s) => s.id === hedefId);
  if (!hedef) throw new Error("Hedef sezon bulunamadı.");
  const finans = d.moduller?.finans === true;
  if (ogrenciTasi && finans && sezonGecisFiyatEksikleri(d, kaynakId, hedefId).length) throw new Error("Hedef sezonda fiyatı tanımlı olmayan şube/seviye var.");
  const kaynakGruplar = d.gruplar.filter((g) => g.sezonId === kaynakId);
  const eslesme = new Map<string, string>();
  const gruplar: Grup[] = [];
  for (const g of kaynakGruplar) {
    if (g.seviye >= EN_YUKSEK_SEVIYE) continue;
    const id = yeniId("g");
    eslesme.set(g.id, id);
    // Ayrılmış veya şubeden alınmış rehber öğretmen yeni gruba taşınmaz
    const rehber = d.personel.find((p) => p.id === g.rehberId);
    const rehberId = rehber && rehber.aktif && rehber.subeIds.includes(g.subeId) ? g.rehberId : "";
    gruplar.push({ ...g, id, sezonId: hedefId, seviye: g.seviye + 1, ad: grupAdiGecisi(g.ad, g.seviye + 1), rehberId });
  }
  const kayitlar: Kayit[] = [];
  if (ogrenciTasi) {
    const yil = Number(hedef.baslangic.slice(0, 4));
    const nolar = d.kayitlar.map((k) => k.sozlesmeNo);
    for (const k of d.kayitlar) {
      if (k.sezonId !== kaynakId || k.durum !== "aktif" || !eslesme.has(k.grupId)) continue;
      const grupId = eslesme.get(k.grupId)!;
      const kod = d.subeler.find((s) => s.id === k.subeId)?.kod ?? "SUB";
      const no = sozlesmeNo(kod, yil, nolar);
      nolar.push(no);
      const { iceAktarmaId: _ia, ...temel } = k;
      void _ia;
      // Fiyat, indirim ve ek hizmet eski kayıttan kopyalanmaz; hedef sezonun liste fiyatı uygulanır (finans kapalıysa ücret yok)
      const seviye = gruplar.find((g) => g.id === grupId)!.seviye;
      const liste = finans ? (fiyatBul(d.fiyatListesi, hedefId, k.subeId, seviye) ?? 0) : 0;
      kayitlar.push({
        ...temel,
        id: yeniId("k"),
        sezonId: hedefId,
        grupId,
        durum: "aktif",
        tarih: hedef.baslangic,
        grupGecmisi: [{ grupId, tarih: hedef.baslangic }],
        kvkkOnay: null,
        sozlesmeNo: no,
        ekHizmetler: [],
        indirimler: [],
        listeFiyati: liste,
        net: liste,
      });
    }
  }
  const mezunGruplar = new Set(kaynakGruplar.filter((g) => g.seviye >= EN_YUKSEK_SEVIYE).map((g) => g.id));
  const mezunlar = d.kayitlar
    .filter((k) => k.sezonId === kaynakId && mezunGruplar.has(k.grupId) && (k.durum === "aktif" || k.durum === "dondurulmus"))
    .map((k) => ({ ...k, durum: "mezun" as const }));
  return { gruplar, kayitlar, mezunGrupSayisi: kaynakGruplar.length - gruplar.length, mezunlar };
}

/** Geçiş iki kez yapılamaz: hedef sezonda grup varsa engellenir. */
export function sezonGecisEngeli(d: Pick<Db, "gruplar">, kaynakId: string | undefined, hedefId: string): Hata {
  if (!kaynakId) return "Aktif sezon yok.";
  if (!hedefId) return "Hedef sezon seçilmeli.";
  if (hedefId === kaynakId) return "Hedef sezon aktif sezondan farklı olmalı.";
  if (d.gruplar.some((g) => g.sezonId === hedefId)) return "Hedef sezonda zaten grup var; geçiş iki kez yapılamaz.";
  return null;
}

/* ---------- Grup ---------- */
export function grupDogrula(
  g: Pick<Grup, "id" | "subeId" | "sezonId" | "seviye" | "ad" | "kapasite" | "derslikId">,
  d: Pick<Db, "gruplar" | "derslikler">,
): Hata {
  if (bos(g.subeId)) return "Şube seçilmeli.";
  if (bos(g.ad)) return "Grup adı boş olamaz.";
  if (!Number.isInteger(g.seviye) || g.seviye < EN_DUSUK_SEVIYE || g.seviye > EN_YUKSEK_SEVIYE) return "Seviye 3–8 arasında olmalı.";
  if (!kapasiteGecerli(g.kapasite)) return `Kapasite 1–${EN_BUYUK_KAPASITE} arasında tam sayı olmalı.`;
  if (d.gruplar.some((x) => x.id !== g.id && x.sezonId === g.sezonId && x.subeId === g.subeId && ayniAd(x.ad, g.ad))) return "Bu şubede aynı adlı grup var.";
  if (g.derslikId) {
    const dl = d.derslikler.find((x) => x.id === g.derslikId);
    if (!dl) return "Seçilen derslik bulunamadı.";
    if (dl.subeId !== g.subeId) return "Derslik grubun şubesine ait olmalı.";
    if (!tanimAktif(dl)) return "Seçilen derslik pasif; aktif bir derslik seçin.";
  }
  return null;
}

/* ---------- Ders ---------- */
export const RENK_DESENI = /^#[0-9a-fA-F]{6}$/;

/** Kısa ad girilmediyse adın ilk 3 harfi */
export function dersKisaAdi(ad: string, kisaAd: string): string {
  return (kisaAd.trim() || ad.trim().slice(0, 3)).toLocaleUpperCase("tr-TR");
}

export function dersDogrula(f: { id?: string; ad: string; kisaAd: string; renk: string }, mevcut: Ders[]): Hata {
  if (bos(f.ad)) return "Ders adı boş olamaz.";
  if (bos(f.kisaAd) || f.kisaAd.trim().length > 4) return "Kısa ad 1–4 karakter olmalı.";
  if (!RENK_DESENI.test(f.renk)) return "Renk #RRGGBB biçiminde olmalı.";
  if (mevcut.some((x) => x.id !== f.id && ayniAd(x.ad, f.ad))) return "Bu adla bir ders zaten var.";
  return null;
}

/* ---------- Derslik ---------- */
export function derslikDogrula(f: { id?: string; subeId: string; ad: string; kapasite: number; aktif?: unknown }, mevcut: Derslik[]): Hata {
  if (bos(f.subeId)) return "Şube seçilmeli.";
  if (aktiflikGecersiz(f.aktif)) return "Aktif/pasif değeri geçersiz.";
  if (bos(f.ad)) return "Derslik adı boş olamaz.";
  if (!kapasiteGecerli(f.kapasite)) return `Kapasite 1–${EN_BUYUK_KAPASITE} arasında tam sayı olmalı.`;
  if (mevcut.some((x) => x.id !== f.id && x.subeId === f.subeId && ayniAd(x.ad, f.ad))) return "Bu şubede aynı adlı derslik var.";
  return null;
}

/**
 * Derslik bir grubun varsayılan dersliğiyse veya ders programında (geçmiş dahil) geçiyorsa silinemez;
 * geçmiş programdan silmek eski yoklama/oturum kayıtlarını dersliksiz bırakırdı.
 */
export function derslikSilmeEngeli(id: string, d: { gruplar: Pick<Grup, "derslikId">[]; program: Pick<ProgramSatiri, "derslikId">[] }): Hata {
  if (d.gruplar.some((g) => g.derslikId === id)) return "Bu derslik bir grubun varsayılan dersliği; önce grubu güncelleyin ya da dersliği pasife alın.";
  if (d.program.some((p) => p.derslikId === id)) return "Bu derslik ders programında kullanılıyor (geçmiş dönem dahil); silinemez, pasife alınabilir.";
  return null;
}

/* ---------- Ders saati ---------- */
export const GUN_TIPLERI = ["hafta-ici", "hafta-sonu"] as const;

export function saatGecerli(s: unknown): boolean {
  return typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

/** Aynı şube ve gün tipinde iki dilim örtüşemez (uç uca değmek serbest). */
export function dersSaatiDogrula(h: Pick<DersSaati, "id" | "subeId" | "gunTipi" | "baslangic" | "bitis"> & { aktif?: unknown }, mevcut: DersSaati[]): Hata {
  if (bos(h.subeId)) return "Şube seçilmeli.";
  if (aktiflikGecersiz(h.aktif)) return "Aktif/pasif değeri geçersiz.";
  if (!(GUN_TIPLERI as readonly string[]).includes(h.gunTipi)) return "Gün tipi geçersiz.";
  if (!saatGecerli(h.baslangic) || !saatGecerli(h.bitis)) return "Saat SS:DD biçiminde olmalı.";
  if (dakika(h.bitis) <= dakika(h.baslangic)) return "Bitiş saati başlangıçtan sonra olmalı.";
  const cakisan = mevcut.find(
    (x) => x.id !== h.id && x.subeId === h.subeId && x.gunTipi === h.gunTipi && dakika(x.baslangic) < dakika(h.bitis) && dakika(h.baslangic) < dakika(x.bitis),
  );
  return cakisan ? `Bu saat aralığı ${cakisan.baslangic}–${cakisan.bitis} dilimiyle çakışıyor.` : null;
}

/** Ders programında (geçmiş dahil) kullanılan ders saati silinemez. */
export function dersSaatiSilmeEngeli(id: string, program: Pick<ProgramSatiri, "saatId">[]): Hata {
  return program.some((p) => p.saatId === id) ? "Bu ders saati ders programında kullanılıyor (geçmiş dönem dahil); silinemez, pasife alınabilir." : null;
}

/* ---------- Ders programı ataması ---------- */
/**
 * Program satırı pasif derslik veya ders saatine atanamaz. Yalnızca değişen alan denetlenir:
 * eski = aynı kimlikli önceki satır (yeni satırda undefined). Pasife alınmadan önce yapılmış,
 * değişmemiş atamalar (ör. satırın bitişini girmek) kilitlenmez.
 */
export function programAtamaEngeli(
  p: Pick<ProgramSatiri, "derslikId" | "saatId">,
  eski: Pick<ProgramSatiri, "derslikId" | "saatId"> | undefined,
  d: Pick<Db, "derslikler" | "dersSaatleri">,
): Hata {
  if (p.derslikId !== eski?.derslikId) {
    const dl = d.derslikler.find((x) => x.id === p.derslikId);
    if (dl && !tanimAktif(dl)) return "Seçilen derslik pasif; yeni derse aktif bir derslik seçin.";
  }
  if (p.saatId !== eski?.saatId) {
    const h = d.dersSaatleri.find((x) => x.id === p.saatId);
    if (h && !tanimAktif(h)) return "Bu ders saati pasif; yeni ders aktif bir saate konmalı.";
  }
  return null;
}

/** Şubenin dilimlerini her gün tipinde başlangıca göre 1'den numaralar; diğer şubelere dokunmaz. */
export function dersSaatleriniSirala(saatler: DersSaati[], subeId: string): DersSaati[] {
  const sira = new Map<string, number>();
  for (const tip of GUN_TIPLERI) {
    saatler
      .filter((h) => h.subeId === subeId && h.gunTipi === tip)
      .sort((a, b) => dakika(a.baslangic) - dakika(b.baslangic))
      .forEach((h, i) => sira.set(h.id, i + 1));
  }
  return saatler.map((h) => (sira.has(h.id) && sira.get(h.id) !== h.sira ? { ...h, sira: sira.get(h.id)! } : h));
}

/* ---------- Fiyat listesi (karar 2026-11-07: sezon + şube + seviye) ---------- */
const kurusMu = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;

/** Sezon, şube ve seviye için liste fiyatı; tanımlı değilse null */
export function fiyatBul(liste: FiyatSatiri[] | null | undefined, sezonId: string, subeId: string, seviye: number | undefined): number | null {
  if (!Array.isArray(liste) || seviye === undefined) return null;
  return liste.find((x) => x.sezonId === sezonId && x.subeId === subeId && x.seviye === seviye)?.fiyat ?? null;
}

/**
 * Fiyat listesi: satır dizisi; her satırda sezon, şube, seviye (3–8) ve negatif olmayan, kuruş hassasiyetinde fiyat.
 * Aynı sezon + şube + seviye iki kez tanımlanamaz. d verilirse sezon ve şube var olmalı.
 * Tanımsız hücre "fiyat yok" demektir (0 TL ücretsiz demektir).
 */
export function fiyatListesiDogrula(f: unknown, d?: Pick<Db, "sezonlar" | "subeler">): Hata {
  if (!Array.isArray(f)) return "Fiyat listesi geçersiz.";
  const gorulen = new Set<string>();
  for (const x of f as Partial<FiyatSatiri>[]) {
    if (!x || typeof x !== "object" || typeof x.sezonId !== "string" || typeof x.subeId !== "string") return "Fiyat listesi geçersiz.";
    if (!(SEVIYELER as readonly number[]).includes(x.seviye as number)) return "Fiyat satırının seviyesi 3–8 arasında olmalı.";
    if (!fiyatGecerli(x.fiyat) || !kurusMu(x.fiyat as number)) return "Liste fiyatı negatif olmayan, en fazla iki ondalıklı (kuruş) bir sayı olmalı.";
    const a = `${x.sezonId}|${x.subeId}|${x.seviye}`;
    if (gorulen.has(a)) return "Aynı sezon, şube ve seviye için iki fiyat tanımlanamaz.";
    gorulen.add(a);
    if (d && !d.sezonlar.some((s) => s.id === x.sezonId)) return "Fiyat listesindeki sezon bulunamadı.";
    if (d && !d.subeler.some((s) => s.id === x.subeId)) return "Fiyat listesindeki şube bulunamadı.";
  }
  return null;
}

/**
 * Eski veri ve yedeklerle uyum: eski biçim (şube → tek fiyat) yeni biçime çevrilir.
 * Eski fiyat o şubenin tek fiyatıydı; bu yüzden var olan her sezon ve her seviye için aynı fiyat yazılır.
 * Sonradan eklenen sezonların fiyatı ayrıca tanımlanmalıdır. Yeni biçimde bozuk satırlar atılır.
 */
export function fiyatListesiNormalize(ham: unknown, d: Pick<Db, "sezonlar">): FiyatSatiri[] {
  if (Array.isArray(ham)) {
    const gorulen = new Set<string>();
    return (ham as Partial<FiyatSatiri>[]).filter((x): x is FiyatSatiri => {
      if (!x || typeof x !== "object" || typeof x.sezonId !== "string" || typeof x.subeId !== "string") return false;
      if (!(SEVIYELER as readonly number[]).includes(x.seviye as number) || !fiyatGecerli(x.fiyat)) return false;
      const a = `${x.sezonId}|${x.subeId}|${x.seviye}`;
      if (gorulen.has(a)) return false;
      gorulen.add(a);
      return true;
    }).map((x) => ({ sezonId: x.sezonId, subeId: x.subeId, seviye: x.seviye, fiyat: Math.round(x.fiyat * 100) / 100 }));
  }
  if (!ham || typeof ham !== "object") return [];
  const satirlar: FiyatSatiri[] = [];
  for (const [subeId, fiyat] of Object.entries(ham as Record<string, unknown>)) {
    if (!fiyatGecerli(fiyat)) continue;
    for (const z of d.sezonlar ?? []) for (const seviye of SEVIYELER) satirlar.push({ sezonId: z.id, subeId, seviye, fiyat: Math.round((fiyat as number) * 100) / 100 });
  }
  return satirlar;
}

/** Bir sezonun fiyatlarını yenileriyle değiştirir (diğer sezonlar korunur). Boş (NaN/undefined) hücre satır üretmez. */
export function sezonFiyatlariniYaz(liste: FiyatSatiri[], sezonId: string, hucreler: { subeId: string; seviye: number; fiyat: number | undefined }[]): FiyatSatiri[] {
  const yeni = hucreler
    .filter((h) => h.fiyat !== undefined && !Number.isNaN(h.fiyat))
    .map((h) => ({ sezonId, subeId: h.subeId, seviye: h.seviye, fiyat: h.fiyat as number }));
  return [...liste.filter((x) => x.sezonId !== sezonId), ...yeni];
}
