/**
 * Bölüm 05 · Finans — saf iş kuralları (ödeme planı, tahsilat, kasa).
 * Ekran (anında geri bildirim) ve sunucu (server/politika.ts · finansDenetle, son söz) aynı fonksiyonları kullanır.
 * Yalnızca göreli içe aktarma ve tip içe aktarması yapılır. Testler: kurallar.test.ts, sunucu.test.ts
 *
 * Tüm tutarlar TL, kuruş hassasiyetinde: karşılaştırmalar kuruş (tam sayı) üzerinden yapılır.
 */
import type { CaymaBedeli, Db, FinansIptal, Gider, Iade, IptalHesabi, Kayit, Rol, Tahsilat, Taksit, Virman } from "../../data/model";
import { ekHizmetler as EK_HIZMETLER, indirimTurleri as INDIRIM_TURLERI } from "../../data/mock";
import { gunFarki } from "../../lib/kurallar";
import { fiyatBul, type Hata } from "../01-kurum-yapisi/kurallar";

export type { Hata };

/* =========================== Tutar ve kuruş =========================== */
/** En fazla bir tutar (yanlış yazımı yakalamak için): 100 milyon TL */
export const EN_BUYUK_TUTAR = 100_000_000;

export const kurusa = (n: number) => Math.round(n * 100);
export const kurus = (n: number) => Math.round(n * 100) / 100;
const kurusMu = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;

/** Geçerli tutar: sonlu, en fazla iki ondalık, üst sınır altında; varsayılan sıfırdan büyük */
export function tutarGecerli(n: unknown, secenek: { sifirOlur?: boolean } = {}): n is number {
  if (typeof n !== "number" || !Number.isFinite(n) || n > EN_BUYUK_TUTAR || !kurusMu(n)) return false;
  return secenek.sifirOlur ? n >= 0 : n > 0;
}

/**
 * Ekrandaki tutar kutusu: "1.250,50", "1250,5", "1250.50", "₺ 1 250" kabul edilir. Geçersizse NaN.
 * Üç basamaklı gruplar nokta ile ayrılmışsa (1.250) binlik ayırıcı sayılır. İkiden fazla ondalık reddedilir.
 */
export function tutarCoz(metin: string): number {
  const s = String(metin ?? "").replace(/[\s₺]/g, "");
  if (!s) return NaN;
  let n = s;
  if (s.includes(",")) n = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) n = s.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(n)) return NaN;
  return Number(n);
}

const isoTarihMi = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s + "T00:00:00").getTime());
const yoneticiMi = (rol: Rol) => rol === "genel-yonetici" || rol === "sube-muduru";
const ayni = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Taksitin kalan borcu (kuruş yuvarlamalı) */
export const kalan = (t: Pick<Taksit, "tutar" | "odenen">) => kurus(t.tutar - t.odenen);

/* =========================== Kayıt ücreti =========================== */
export type Indirim = { ad: string; oran: number };

/** Ek hizmet (kitap, etüt paketi) liste fiyatı; tanımsızsa null */
export const ekHizmetFiyati = (ad: string) => EK_HIZMETLER.find((h) => h.ad === ad)?.fiyat ?? null;

/**
 * Kayıt ücreti: liste fiyatına indirim oranları toplamı uygulanır (en fazla %100, net hiçbir zaman negatif olmaz),
 * ek hizmetler indirimsiz eklenir. Tüm ara tutarlar kuruşa yuvarlanır.
 */
export function kayitUcreti(liste: number, indirimler: Indirim[], hizmetler: string[]) {
  const oran = Math.max(0, Math.min(100, indirimler.reduce((t, i) => t + (Number(i.oran) || 0), 0)));
  const listeK = kurusa(Math.max(0, liste));
  const indirimliK = Math.round((listeK * (100 - oran)) / 100);
  const hizmetK = hizmetler.reduce((t, ad) => t + kurusa(ekHizmetFiyati(ad) ?? 0), 0);
  return { oran, indirimTutari: (listeK - indirimliK) / 100, hizmetTutari: hizmetK / 100, net: (indirimliK + hizmetK) / 100 };
}

/** İndirimler yalnızca tanımlı indirim türleridir (ad + oran aynı), her biri bir kez; toplam %100'ü aşamaz. */
export function indirimlerEngeli(l: unknown): Hata {
  if (!Array.isArray(l)) return "İndirim bilgisi geçersiz.";
  const adlar = new Set<string>();
  let toplam = 0;
  for (const i of l as Partial<Indirim>[]) {
    const tur = INDIRIM_TURLERI.find((x) => x.ad === i?.ad);
    if (!tur || tur.oran !== i?.oran) return "Yalnızca tanımlı indirim türleri uygulanabilir.";
    if (adlar.has(tur.ad)) return "Aynı indirim iki kez uygulanamaz.";
    adlar.add(tur.ad);
    toplam += tur.oran;
  }
  return toplam > 100 ? "İndirimlerin toplamı %100'ü aşamaz." : null;
}

/** Ek hizmetler yalnızca tanımlı hizmetlerdir, her biri bir kez. */
export function ekHizmetlerEngeli(l: unknown): Hata {
  if (!Array.isArray(l)) return "Ek hizmet bilgisi geçersiz.";
  if (l.some((ad) => typeof ad !== "string" || ekHizmetFiyati(ad) === null)) return "Yalnızca tanımlı ek hizmetler eklenebilir.";
  return new Set(l).size !== l.length ? "Aynı ek hizmet iki kez eklenemez." : null;
}

/**
 * Kayıt satırının ücret alanları (liste fiyatı, indirimler, net, ek hizmetler).
 * - Finans kapalıyken yeni kayda ücret yazılmaz, var olanın ücreti değiştirilmez.
 * - Finans açıkken yeni ücretli kayıt: liste fiyatı fiyat listesindeki (sezon + şube + grubun seviyesi) fiyattır;
 *   fiyat tanımsızsa kayıt açılmaz. Net = kayitUcreti(...). Ücretsiz kayıt (0 / 0) yalnızca yönetici veya içe aktarma.
 * - Var olan kaydın ücreti / indirimi yalnızca yönetici (genel yönetici, şube müdürü) tarafından değişir (doküman: indirim yetkisi).
 */
export function kayitUcretEngeli(
  k: Kayit,
  eski: Kayit | undefined,
  d: Pick<Db, "fiyatListesi" | "gruplar" | "moduller">,
  secenek: { rol: Rol },
): Hata {
  const ucretDegisti = !eski || eski.listeFiyati !== k.listeFiyati || eski.net !== k.net || !ayni(eski.indirimler, k.indirimler);
  const hizmetDegisti = !eski || !ayni(eski.ekHizmetler, k.ekHizmetler);
  const bekleyenDegisti = !ayni(eski?.bekleyenIndirim?.indirimler ?? null, k.bekleyenIndirim?.indirimler ?? null);
  if (!ucretDegisti && !hizmetDegisti && !bekleyenDegisti) return null;
  if (hizmetDegisti) {
    const h = ekHizmetlerEngeli(k.ekHizmetler);
    if (h) return h;
  }
  const finans = d.moduller?.finans === true;
  if (!finans) {
    if (!eski && (k.listeFiyati !== 0 || k.net !== 0 || (Array.isArray(k.indirimler) && k.indirimler.length))) return "Finans modülü kapalıyken kayda ücret yazılamaz.";
    if (eski && (ucretDegisti || bekleyenDegisti)) return "Finans modülü kapalıyken kaydın ücret bilgisi değiştirilemez.";
    if (!eski && k.bekleyenIndirim) return "Finans modülü kapalıyken indirim istenemez.";
    return null;
  }
  const yonetici = yoneticiMi(secenek.rol);
  // İndirim onayı (karar 2026-11-08): sekreter tanımlı indirimi seçer, kayıtta "onay bekliyor" olarak durur;
  // onaylanana kadar net ve plan indirimsizdir. Onay / ret yalnızca yönetici.
  if (bekleyenDegisti) {
    if (k.bekleyenIndirim) {
      if (eski) return "İndirim onay talebi yalnızca kayıt sırasında oluşturulur.";
      if (yonetici) return "Yönetici indirimi doğrudan uygular; onay talebi gerekmez.";
      if (!Array.isArray(k.bekleyenIndirim.indirimler) || !k.bekleyenIndirim.indirimler.length) return "Onaya gönderilen indirim boş olamaz.";
      const h = indirimlerEngeli(k.bekleyenIndirim.indirimler);
      if (h) return h;
    } else if (!yonetici) return "İndirim talebini yalnızca yönetici onaylar veya reddeder.";
  }
  if (!ucretDegisti && !hizmetDegisti) return null;
  if (!tutarGecerli(k.listeFiyati, { sifirOlur: true }) || !tutarGecerli(k.net, { sifirOlur: true }))
    return "Ücret tutarları negatif olmayan, kuruş hassasiyetinde sayı olmalı.";
  const ind = indirimlerEngeli(k.indirimler);
  if (ind) return ind;
  if (!eski && !yonetici && k.indirimler.length) return "Sekreterin seçtiği indirim yönetici onayıyla uygulanır (onay bekliyor olarak kaydedin).";
  if (eski && ucretDegisti && !yonetici) return "Kaydın ücretini ve indirimini yalnızca yönetici değiştirebilir.";
  const ucretsiz = k.listeFiyati === 0 && k.net === 0 && k.indirimler.length === 0;
  if (ucretsiz) {
    if (!eski && !yonetici && !k.iceAktarmaId) return "Ücretsiz kayıt yalnızca yönetici tarafından yapılabilir.";
    return null;
  }
  if (!eski) {
    const seviye = d.gruplar.find((g) => g.id === k.grupId)?.seviye;
    const f = fiyatBul(d.fiyatListesi, k.sezonId, k.subeId, seviye);
    if (f === null) return "Bu sezon, şube ve seviye için fiyat tanımlı değil (Bölüm 01 · Fiyat listesi).";
    if (kurusa(k.listeFiyati) !== kurusa(f)) return "Liste fiyatı fiyat listesindeki fiyatla aynı olmalı.";
  }
  if (kurusa(k.net) !== kurusa(kayitUcreti(k.listeFiyati, k.indirimler, k.ekHizmetler).net))
    return "Net tutar liste fiyatı, indirimler ve ek hizmetlerle uyuşmuyor.";
  return null;
}

/** Ek kalem (ör. etüt paketi) taksit numarası 99 ve üstüdür; ödeme planı bunların dışındadır. */
export const EK_KALEM_NO = 99;

/** Kayıtla birlikte oluşturulan ödeme planının toplamı kuruşu kuruşuna net tutara eşit olmalı. */
export function planToplamEngeli(net: number, plan: Pick<Taksit, "tutar" | "no">[]): Hata {
  const p = plan.filter((t) => t.no < EK_KALEM_NO);
  if (!p.length) return null;
  const toplam = p.reduce((s, t) => s + kurusa(t.tutar), 0);
  return toplam !== kurusa(net) ? "Taksitlerin toplamı kaydın net tutarına eşit olmalı." : null;
}

/* =========================== Taksit =========================== */
const TAKSIT_KILITLI = ["kayitId", "ogrenciId", "veliId", "no"] as const;

/**
 * Taksit satırının yazılması. odenenFarki: aynı paketteki yeni tahsilat ve tahsilat iptallerinin bu taksite
 * etkisi (kuruş). Ödenen tutar yalnızca tahsilatla değişir; fazla tahsilat (ödenen > tutar) yoktur.
 * - yeni taksit: finans açık, süren kayda bağlı, kaydın öğrencisi/şubesi, öğrencinin velisi, ödenen 0
 * - şube değişikliği yalnızca kaydıyla birlikte (nakil devri)
 * - tutar / vade değişikliği yalnızca yönetici; tutar ödenenin altına inmez
 */
export function taksitYazmaEngeli(
  t: Taksit,
  eski: Taksit | undefined,
  d: Pick<Db, "kayitlar" | "ogrenciler">,
  secenek: { finans: boolean; rol: Rol; odenenFarki: number; beklenenTutar?: number },
): Hata {
  if (!t || typeof t !== "object") return "Taksit bilgisi geçersiz.";
  const kayit = d.kayitlar.find((k) => k.id === t.kayitId);
  if (!eski) {
    if (!secenek.finans) return "Finans modülü kapalıyken ödeme planı oluşturulamaz.";
    if (!kayit) return "Taksitin kaydı bulunamadı.";
    if (kayit.durum !== "aktif" && kayit.durum !== "dondurulmus") return "Süren olmayan (iptal / mezun) kayda taksit eklenemez.";
    if (t.ogrenciId !== kayit.ogrenciId || t.subeId !== kayit.subeId) return "Taksit kaydın öğrencisi ve şubesiyle uyumlu olmalı.";
    if (!d.ogrenciler.find((o) => o.id === t.ogrenciId)?.veliIds.includes(t.veliId)) return "Taksitin velisi öğrencinin velisi olmalı.";
    if (!Number.isInteger(t.no) || t.no < 0) return "Taksit sırası geçersiz.";
    if (!tutarGecerli(t.tutar)) return "Taksit tutarı sıfırdan büyük, kuruş hassasiyetinde olmalı.";
    if (t.odenen !== 0 || secenek.odenenFarki !== 0) return "Yeni taksitte ödenen tutar sıfırdır; ödeme tahsilatla girilir.";
    if (!isoTarihMi(t.vade)) return "Taksit vadesi geçersiz.";
    return null;
  }
  for (const a of TAKSIT_KILITLI) if (eski[a] !== t[a]) return "Taksitin kaydı, öğrencisi, velisi ve sırası değiştirilemez.";
  if (t.subeId !== eski.subeId && (!kayit || t.subeId !== kayit.subeId)) return "Taksit yalnızca kaydıyla birlikte başka şubeye devredilir.";
  if (typeof t.odenen !== "number" || kurusa(t.odenen) - kurusa(eski.odenen) !== secenek.odenenFarki)
    return "Ödenen tutar yalnızca tahsilat veya tahsilat iptaliyle değişir.";
  if (secenek.beklenenTutar !== undefined) {
    // Kayıt iptali / indirim onayı paketi: tutar hesaplanan değere eşit olmalı (iptalde 0'a kadar kapanabilir)
    if (typeof t.tutar !== "number" || kurusa(t.tutar) !== kurusa(secenek.beklenenTutar)) return "Taksit tutarı iptal / indirim hesabıyla uyuşmuyor.";
    if (t.vade !== eski.vade) return "Taksit vadesi bu işlemde değiştirilemez.";
  } else if (t.tutar !== eski.tutar || t.vade !== eski.vade) {
    if (!secenek.finans) return "Finans modülü kapalıyken taksit değiştirilemez.";
    if (!yoneticiMi(secenek.rol)) return "Taksit tutarını ve vadesini yalnızca yönetici değiştirebilir.";
    if (!tutarGecerli(t.tutar)) return "Taksit tutarı sıfırdan büyük, kuruş hassasiyetinde olmalı.";
    if (!isoTarihMi(t.vade)) return "Taksit vadesi geçersiz.";
  }
  if (t.odenen < 0) return "Ödenen tutar negatif olamaz.";
  if (kurusa(t.odenen) > kurusa(t.tutar)) return t.tutar !== eski.tutar ? "Taksit tutarı ödenen tutarın altına indirilemez." : "Fazla tahsilat: ödenen tutar taksit tutarını aşamaz.";
  return null;
}

/**
 * Otomatik hatırlatma (vade öncesi / gecikme) yalnızca süren aktif veya mezun kaydın taksitine gider.
 * İptal edilen ve dondurulan kaydın kalan borcu silinmez (cari hesapta görünür, tahsil edilebilir)
 * ama veliye otomatik / toplu hatırlatma gönderilmez.
 */
export function otomatikHatirlatmaUygun(t: Taksit, kayitlar: Pick<Kayit, "id" | "durum">[]): boolean {
  if (kalan(t) <= 0) return false;
  const k = kayitlar.find((x) => x.id === t.kayitId);
  return !k || k.durum === "aktif" || k.durum === "mezun";
}

/* =========================== Plan yeniden dağıtımı (indirim onayı) =========================== */
const planSirala = <T extends Pick<Taksit, "vade" | "no">>(l: T[]) => [...l].sort((a, b) => a.vade.localeCompare(b.vade) || a.no - b.no);
/** Kaydın ödeme planı (ek kalemler hariç) */
export const kayitPlani = <T extends Pick<Taksit, "kayitId" | "no">>(taksitler: T[], kayitId: string) => taksitler.filter((t) => t.kayitId === kayitId && t.no < EK_KALEM_NO);

/**
 * Net tutar değişince (indirim onayı) ödenmemiş kısım açık taksitlere eski kalanlarıyla orantılı yeniden dağıtılır;
 * ödenen tutarlar ve kapanmış taksitler değişmez, toplam kuruşu kuruşuna yeni nete eşit olur (küsurat son açık taksitte).
 * Ödenen toplamı yeni netten büyükse dağıtım yapılmaz (önce iade gerekir).
 */
export function planiYenidenDagit(plan: Taksit[], yeniNet: number): { tutarlar: Map<string, number>; hata: Hata } {
  const p = planSirala(plan.filter((t) => t.no < EK_KALEM_NO));
  const tutarlar = new Map(p.map((t) => [t.id, t.tutar]));
  const odenenK = p.reduce((s, t) => s + kurusa(t.odenen), 0);
  const R = kurusa(yeniNet) - odenenK;
  if (R < 0) return { tutarlar, hata: "Ödenen tutar yeni net tutarı aşıyor; indirim uygulanamaz (önce fazla ödenen iade edilmeli)." };
  const acik = p.filter((t) => kurusa(t.tutar) > kurusa(t.odenen));
  if (!acik.length) return { tutarlar, hata: R > 0 ? "Açık taksit yok; fark için ek kalem gerekir." : null };
  const K = acik.reduce((s, t) => s + kurusa(t.tutar) - kurusa(t.odenen), 0);
  let dagitilan = 0;
  acik.forEach((t, i) => {
    const pay = i === acik.length - 1 ? R - dagitilan : Math.floor((R * (kurusa(t.tutar) - kurusa(t.odenen))) / K);
    dagitilan += pay;
    tutarlar.set(t.id, (kurusa(t.odenen) + pay) / 100);
  });
  return { tutarlar, hata: null };
}

/* =========================== Kayıt iptali: kullanılan, cayma, iade (karar 2026-11-08) =========================== */
export function caymaBedeliEngeli(c: unknown): Hata {
  if (c === undefined || c === null) return null;
  const x = c as Partial<CaymaBedeli>;
  if (typeof x !== "object" || (x.tur !== "yuzde" && x.tur !== "sabit")) return "Cayma bedeli türü yüzde veya sabit tutar olmalı.";
  if (!tutarGecerli(x.deger, { sifirOlur: true })) return "Cayma bedeli negatif olmayan, kuruş hassasiyetinde sayı olmalı.";
  if (x.tur === "yuzde" && (x.deger as number) > 100) return "Cayma bedeli yüzdesi 0–100 arasında olmalı.";
  return null;
}

/** Cayma bedeli: yüzde ise plan toplamı üzerinden, sabitse tutar; plan toplamını aşmaz. Ayar yoksa 0. */
export function caymaTutari(ayar: CaymaBedeli | undefined | null, toplam: number): number {
  if (!ayar || caymaBedeliEngeli(ayar)) return 0;
  const k = ayar.tur === "yuzde" ? Math.round((kurusa(toplam) * ayar.deger) / 100) : kurusa(ayar.deger);
  return Math.min(k, kurusa(toplam)) / 100;
}

/**
 * Kullanılan (hak edilmiş) tutar — takvim günü oranı: hizmet başlangıcı (kayıt tarihi, sezon başlangıcından önceyse sezon başlangıcı)
 * ile sezon bitişi arasındaki günlerin, iptal gününe kadar (iptal günü dahil) geçen kısmı. Başlangıçtan önce iptal 0, bitişten sonra tamamı.
 * Sezon bilinmiyorsa tamamı kullanılmış sayılır (iade çıkmaz; yönetici gerekçeyle düzeltebilir).
 */
export function kullanilanTutar(toplam: number, baslangic: string, bitis: string | undefined, tarih: string): number {
  if (!bitis || !isoTarihMi(baslangic) || !isoTarihMi(bitis) || bitis < baslangic) return kurus(toplam);
  const gunSayisi = gunFarki(baslangic, bitis) + 1;
  const gecen = Math.max(0, Math.min(gunSayisi, gunFarki(baslangic, tarih) + 1));
  return Math.round((kurusa(toplam) * gecen) / gunSayisi) / 100;
}

/** Hesabın başlangıç tarihi: kayıt tarihi ile sezon başlangıcından sonra olanı */
export const hizmetBaslangici = (kayitTarihi: string, sezon: { baslangic: string } | undefined) =>
  sezon && sezon.baslangic > kayitTarihi ? sezon.baslangic : kayitTarihi;

/**
 * İptal hesabı: toplam = ödeme planı (ek kalemler hariç); hak = min(toplam, kullanılan + cayma);
 * ödenen > hak ise iade = ödenen − hak, değilse kalan borç = hak − ödenen. ozel: yöneticinin düzelttiği kullanılan / cayma.
 */
export function iptalHesabiHesapla(
  plan: Pick<Taksit, "tutar" | "odenen" | "no">[],
  kayit: Pick<Kayit, "tarih">,
  sezon: { baslangic: string; bitis: string } | undefined,
  ayar: CaymaBedeli | undefined | null,
  tarih: string,
  ozel?: { kullanilan?: number; cayma?: number },
): IptalHesabi {
  const p = plan.filter((t) => t.no < EK_KALEM_NO);
  const toplamK = p.reduce((s, t) => s + kurusa(t.tutar), 0);
  const odenenK = p.reduce((s, t) => s + kurusa(t.odenen), 0);
  const sinirla = (n: number) => Math.max(0, Math.min(kurusa(n), toplamK));
  const kullanilanK = sinirla(ozel?.kullanilan ?? kullanilanTutar(toplamK / 100, hizmetBaslangici(kayit.tarih, sezon), sezon?.bitis, tarih));
  const caymaK = sinirla(ozel?.cayma ?? caymaTutari(ayar, toplamK / 100));
  const hakK = Math.min(toplamK, kullanilanK + caymaK);
  return {
    tarih,
    toplam: toplamK / 100,
    kullanilan: kullanilanK / 100,
    cayma: caymaK / 100,
    hak: hakK / 100,
    odenen: odenenK / 100,
    iade: Math.max(0, odenenK - hakK) / 100,
    kalanBorc: Math.max(0, hakK - odenenK) / 100,
    duzeltme: null,
  };
}

/**
 * İptalde taksitlerin yeni tutarları: kalan borç (hak − ödenen) en eski vadeden başlayarak açık taksitlerde kalır,
 * geri kalan taksitler kapatılır (tutar = ödenen, ödenmemişse 0). İade varsa tüm taksitler ödenen tutarda kapanır.
 */
export function iptalTaksitleri(plan: Taksit[], hak: number): Map<string, number> {
  const p = planSirala(plan.filter((t) => t.no < EK_KALEM_NO));
  let kalanK = Math.max(0, kurusa(hak) - p.reduce((s, t) => s + kurusa(t.odenen), 0));
  const m = new Map<string, number>();
  for (const t of p) {
    const ek = Math.min(Math.max(0, kurusa(t.tutar) - kurusa(t.odenen)), kalanK);
    kalanK -= ek;
    m.set(t.id, (kurusa(t.odenen) + ek) / 100);
  }
  return m;
}

const HESAP_ALANLARI = ["toplam", "kullanilan", "cayma", "hak", "odenen", "iade", "kalanBorc"] as const;

/**
 * İptal hesabının denetimi: tarih bugündür, tutarlar plandan yeniden hesaplanır (yalnızca kullanılan / cayma yöneticice değişebilir).
 * Varsayılandan farklı kullanılan / cayma: yönetici + en az 3 karakter gerekçe. İade çıkan iptal yalnızca yönetici (iade yetkisi).
 */
export function iptalHesabiEngeli(
  h: unknown,
  plan: Taksit[],
  kayit: Pick<Kayit, "tarih">,
  sezon: { baslangic: string; bitis: string } | undefined,
  ayar: CaymaBedeli | undefined | null,
  secenek: { bugun: string; rol: Rol },
): Hata {
  const x = h as Partial<IptalHesabi>;
  if (!x || typeof x !== "object") return "İptal hesabı geçersiz.";
  if (x.tarih !== secenek.bugun) return "İptal hesabı bugünün tarihiyle yapılmalı.";
  if (HESAP_ALANLARI.some((a) => !tutarGecerli(x[a], { sifirOlur: true }))) return "İptal hesabındaki tutarlar negatif olmayan, kuruş hassasiyetinde olmalı.";
  const varsayilan = iptalHesabiHesapla(plan, kayit, sezon, ayar, secenek.bugun);
  if (kurusa(x.kullanilan!) > kurusa(varsayilan.toplam) || kurusa(x.cayma!) > kurusa(varsayilan.toplam)) return "Kullanılan tutar ve cayma bedeli plan toplamını aşamaz.";
  const beklenen = iptalHesabiHesapla(plan, kayit, sezon, ayar, secenek.bugun, { kullanilan: x.kullanilan, cayma: x.cayma });
  if (HESAP_ALANLARI.some((a) => kurusa(x[a]!) !== kurusa(beklenen[a]))) return "İptal hesabı ödeme planıyla uyuşmuyor; hesap yeniden yapılmalı.";
  const duzeltildi = kurusa(x.kullanilan!) !== kurusa(varsayilan.kullanilan) || kurusa(x.cayma!) !== kurusa(varsayilan.cayma);
  const yonetici = yoneticiMi(secenek.rol);
  if (duzeltildi) {
    if (!yonetici) return "Kullanılan tutarı ve cayma bedelini yalnızca yönetici düzeltebilir.";
    if (typeof x.duzeltme?.neden !== "string" || x.duzeltme.neden.trim().length < 3) return "Düzeltme gerekçesi en az 3 karakter olmalı.";
  }
  if (beklenen.iade > 0 && !yonetici) return "İade çıkan iptali yalnızca yönetici (genel yönetici, şube müdürü) yapabilir.";
  return null;
}

/** İade: yalnızca kayıt iptali paketinde, iptal hesabındaki tutarda, yönetici tarafından; kasadan çıkış */
export function iadeEngeli(
  i: Iade,
  d: Pick<Db, "kayitlar" | "ogrenciler">,
  secenek: { finans: boolean; rol: Rol; beklenenTutar: number | undefined },
): Hata {
  if (!secenek.finans) return "Finans modülü kapalı; iade yapılamaz.";
  if (!i || typeof i !== "object") return "İade bilgisi geçersiz.";
  if (secenek.beklenenTutar === undefined) return "İade yalnızca kayıt iptaliyle birlikte, iptal hesabına göre oluşturulur.";
  if (!yoneticiMi(secenek.rol)) return "İadeyi yalnızca genel yönetici veya şube müdürü yapabilir.";
  if (i.iptal) return "Yeni iade iptal edilmiş olarak girilemez.";
  if (!(YONTEMLER as readonly string[]).includes(i.yontem)) return "İade yöntemi geçersiz.";
  if (!tutarGecerli(i.tutar)) return "İade tutarı sıfırdan büyük, kuruş hassasiyetinde olmalı.";
  if (kurusa(i.tutar) !== kurusa(secenek.beklenenTutar)) return "İade tutarı iptal hesabındaki iade tutarıyla aynı olmalı (ödeneni aşamaz).";
  const k = d.kayitlar.find((x) => x.id === i.kayitId);
  if (!k || k.ogrenciId !== i.ogrenciId || k.subeId !== i.subeId) return "İade kaydın öğrencisi ve şubesiyle uyumlu olmalı.";
  if (!d.ogrenciler.find((o) => o.id === i.ogrenciId)?.veliIds.includes(i.veliId)) return "İade öğrencinin velisine yapılır.";
  if (typeof i.makbuzNo !== "string" || !i.makbuzNo.trim()) return "İade makbuz numarası eksik.";
  return null;
}

/* =========================== Tahsilat =========================== */
export const YONTEMLER = ["nakit", "havale", "pos"] as const;
export const yontemAdlari: Record<Tahsilat["yontem"], string> = { nakit: "Nakit", havale: "Havale/EFT", pos: "Kredi kartı (POS)" };

/** Şubenin sıradaki makbuz numarası: tahsilat KOD-M-00001, iade KOD-I-00001 (sayaç şube kodu başına, var olan en büyük numaradan devam) */
export function yeniMakbuzNo(kod: string, nolar: string[], tip: "M" | "I" = "M"): string {
  const onek = `${kod}-${tip}-`;
  const enBuyuk = nolar.filter((n) => typeof n === "string" && n.startsWith(onek)).reduce((m, n) => Math.max(m, Number(n.slice(onek.length)) || 0), 0);
  return `${onek}${String(enBuyuk + 1).padStart(5, "0")}`;
}

/**
 * Yeni tahsilat: finans açık; yöntem; tutar > 0 ve dağılımın toplamına kuruşu kuruşuna eşit; her dağılım satırı
 * ödeyen velinin çocuğunun taksiti ve tahsilatın kasası (subeId) taksitin (öğrencinin kayıtlı olduğu) şubesi;
 * alındığı şube var ve (genel yönetici dışında) yetki kapsamında. Fazla tahsilat taksit kuralında yakalanır.
 */
export function tahsilatEngeli(
  t: Tahsilat,
  d: Pick<Db, "taksitler" | "ogrenciler" | "subeler">,
  secenek: { finans: boolean; kapsam?: string[] },
): Hata {
  if (!secenek.finans) return "Finans modülü kapalı; tahsilat alınamaz.";
  if (!t || typeof t !== "object") return "Tahsilat bilgisi geçersiz.";
  if (t.iptal) return "Yeni tahsilat iptal edilmiş olarak girilemez.";
  if (!(YONTEMLER as readonly string[]).includes(t.yontem)) return "Ödeme yöntemi geçersiz.";
  if (!tutarGecerli(t.tutar)) return "Tahsilat tutarı sıfırdan büyük, kuruş hassasiyetinde olmalı.";
  if (!Array.isArray(t.dagilim) || !t.dagilim.length) return "Tahsilat en az bir taksite dağıtılmalı.";
  if (new Set(t.dagilim.map((x) => x.taksitId)).size !== t.dagilim.length) return "Bir taksit aynı tahsilatta iki kez yer alamaz.";
  let toplam = 0;
  for (const x of t.dagilim) {
    if (!tutarGecerli(x?.tutar)) return "Dağılım tutarları sıfırdan büyük, kuruş hassasiyetinde olmalı.";
    toplam += kurusa(x.tutar);
    const tk = d.taksitler.find((y) => y.id === x.taksitId);
    if (!tk) return "Tahsilatın dağıtıldığı taksit bulunamadı.";
    if (tk.subeId !== t.subeId) return "Tahsilat öğrencinin kayıtlı olduğu şubenin kasasına yazılır.";
    if (!d.ogrenciler.find((o) => o.id === tk.ogrenciId)?.veliIds.includes(t.veliId)) return "Tahsilat yalnızca ödeyen velinin çocuklarının taksitlerine dağıtılır.";
  }
  if (toplam !== kurusa(t.tutar)) return "Tahsilat tutarı taksitlere dağıtılan toplamla aynı olmalı.";
  if (!d.subeler.some((s) => s.id === t.alinanSubeId)) return "Tahsilatın alındığı şube bulunamadı.";
  if (secenek.kapsam && !secenek.kapsam.includes(t.alinanSubeId)) return "Tahsilatın alındığı şube yetki kapsamınızda olmalı.";
  if (typeof t.makbuzNo !== "string" || !t.makbuzNo.trim()) return "Makbuz numarası eksik.";
  return null;
}

/**
 * Finans kaydının iptali (tahsilat, iade, gider, virman — aynı desen): kayıt silinmez ve değiştirilmez; yalnızca yönetici
 * (genel yönetici, şube müdürü) en az 3 karakter gerekçeyle iptal eder; iptal geri alınamaz. Kasada iptal gününe ters kayıt düşer.
 */
export function finansIptalEngeli<T extends { iptal?: FinansIptal | null }>(eski: T, yeni: T, rol: Rol, ad: string): Hata {
  if (eski.iptal) return `İptal edilmiş ${ad.toLocaleLowerCase("tr-TR")} kaydı değiştirilemez.`;
  const sadeceIptal = !!yeni.iptal && ayni({ ...eski, iptal: null }, { ...yeni, iptal: null });
  if (!sadeceIptal) return `${ad} değiştirilemez; yalnızca yönetici iptal edebilir.`;
  if (!yoneticiMi(rol)) return `${ad} kaydını yalnızca genel yönetici veya şube müdürü iptal edebilir.`;
  if (typeof yeni.iptal?.neden !== "string" || yeni.iptal.neden.trim().length < 3) return "İptal gerekçesi en az 3 karakter olmalı.";
  return null;
}

/** Tahsilat silinmez ve değiştirilmez; yalnızca yönetici gerekçeyle iptal eder (iptal geri alınamaz). */
export const tahsilatIptalEngeli = (eski: Tahsilat, yeni: Tahsilat, rol: Rol): Hata => finansIptalEngeli(eski, yeni, rol, "Tahsilat");

/** Yeni tahsilatların ve iptal edilen tahsilatların taksitlere etkisi (kuruş): taksitId → ödenen farkı */
export function odemeFarklari(yeniler: Pick<Tahsilat, "dagilim">[], iptalEdilenler: Pick<Tahsilat, "dagilim">[]): Map<string, number> {
  const m = new Map<string, number>();
  const ekle = (id: string, n: number) => m.set(id, (m.get(id) ?? 0) + n);
  for (const t of yeniler) for (const x of t.dagilim) ekle(x.taksitId, kurusa(x.tutar));
  for (const t of iptalEdilenler) for (const x of t.dagilim) ekle(x.taksitId, -kurusa(x.tutar));
  return m;
}

/* =========================== Kasa =========================== */
export type KasaTuru = "nakit" | "pos" | "banka";
export const KASA_TURLERI: KasaTuru[] = ["nakit", "pos", "banka"];
export const kasaTurAdlari: Record<KasaTuru, string> = { nakit: "Nakit kasa", pos: "POS", banka: "Banka" };
export const MERKEZ = "merkez";
/** Havale / EFT bankaya, nakit nakit kasaya, kart POS'a yazılır */
export const yontemKasa = (y: Tahsilat["yontem"]): KasaTuru => (y === "havale" ? "banka" : y);
export const kasaKimligi = (sube: string, tur: KasaTuru) => `${sube}:${tur}`;
export const kasaSubesi = (k: string) => String(k).split(":")[0];

/** Kasa kimliği: "<şube>:<nakit|pos|banka>" veya Genel Merkez banka hesabı "merkez:banka" */
export function kasaGecerli(k: unknown, subeler: Pick<Db["subeler"][number], "id">[]): boolean {
  if (typeof k !== "string") return false;
  const [s, tur, fazla] = k.split(":");
  if (fazla !== undefined) return false;
  if (s === MERKEZ) return tur === "banka";
  return subeler.some((x) => x.id === s) && (KASA_TURLERI as string[]).includes(tur);
}

export type KasaHareketi = {
  id: string;
  /** ISO tarih veya tarih-saat */
  tarih: string;
  kasa: string;
  tur:
    | "tahsilat" | "tahsilatIptali" | "iade" | "iadeIptali" | "gider" | "giderIptali"
    | "virmanCikis" | "virmanGiris" | "virmanIptalCikis" | "virmanIptalGiris";
  /** tahsilat / iade / gider / virman kimliği */
  ref: string;
  giris: number;
  cikis: number;
};

/**
 * Kasa hareketleri. Geçmiş değiştirilmez: iptal edilen tahsilat / iade / gider / virmanın hareketi kendi tarihinde kalır,
 * iptal tarihinde aynı tutarda ters hareket yazılır. Böylece geçmiş günlerin gün sonu bakiyesi iptalle değişmez.
 * Eski veride iade koleksiyonu ve iptal alanı yoksa yok sayılır.
 */
export function kasaHareketleri(d: Pick<Db, "tahsilatlar" | "giderler" | "virmanlar"> & { iadeler?: Iade[] }): KasaHareketi[] {
  const h: KasaHareketi[] = [];
  for (const t of d.tahsilatlar) {
    const kasa = kasaKimligi(t.subeId, yontemKasa(t.yontem));
    h.push({ id: t.id, tarih: t.zaman, kasa, tur: "tahsilat", ref: t.id, giris: t.tutar, cikis: 0 });
    if (t.iptal) h.push({ id: t.id + "-iptal", tarih: t.iptal.zaman || t.zaman, kasa, tur: "tahsilatIptali", ref: t.id, giris: 0, cikis: t.tutar });
  }
  for (const i of d.iadeler ?? []) {
    const kasa = kasaKimligi(i.subeId, yontemKasa(i.yontem));
    h.push({ id: i.id, tarih: i.zaman, kasa, tur: "iade", ref: i.id, giris: 0, cikis: i.tutar });
    if (i.iptal) h.push({ id: i.id + "-iptal", tarih: i.iptal.zaman || i.zaman, kasa, tur: "iadeIptali", ref: i.id, giris: i.tutar, cikis: 0 });
  }
  for (const g of d.giderler) {
    const kasa = kasaKimligi(g.subeId, g.kasa);
    h.push({ id: g.id, tarih: g.tarih, kasa, tur: "gider", ref: g.id, giris: 0, cikis: g.tutar });
    if (g.iptal) h.push({ id: g.id + "-iptal", tarih: g.iptal.zaman || g.tarih, kasa, tur: "giderIptali", ref: g.id, giris: g.tutar, cikis: 0 });
  }
  for (const v of d.virmanlar) {
    h.push({ id: v.id + "c", tarih: v.tarih, kasa: v.kaynak, tur: "virmanCikis", ref: v.id, giris: 0, cikis: v.tutar });
    h.push({ id: v.id + "g", tarih: v.tarih, kasa: v.hedef, tur: "virmanGiris", ref: v.id, giris: v.tutar, cikis: 0 });
    if (v.iptal) {
      const z = v.iptal.zaman || v.tarih;
      h.push({ id: v.id + "c-iptal", tarih: z, kasa: v.kaynak, tur: "virmanIptalGiris", ref: v.id, giris: v.tutar, cikis: 0 });
      h.push({ id: v.id + "g-iptal", tarih: z, kasa: v.hedef, tur: "virmanIptalCikis", ref: v.id, giris: 0, cikis: v.tutar });
    }
  }
  return h.sort((a, b) => b.tarih.localeCompare(a.tarih) || a.id.localeCompare(b.id));
}

/** Kasa bakiyesi (kuruş yuvarlamalı); gun verilirse o günün sonundaki bakiye */
export function kasaBakiyesi(h: KasaHareketi[], kasa: string, gun?: string): number {
  const k = h.filter((x) => x.kasa === kasa && (!gun || x.tarih.slice(0, 10) <= gun)).reduce((s, x) => s + kurusa(x.giris) - kurusa(x.cikis), 0);
  return k / 100;
}

/** Gün sonu: açılış (önceki gün sonu), günün girişi / çıkışı, kapanış */
export function gunSonuOzeti(h: KasaHareketi[], kasa: string, gun: string) {
  const bugun = h.filter((x) => x.kasa === kasa && x.tarih.slice(0, 10) === gun);
  const acilis = h.filter((x) => x.kasa === kasa && x.tarih.slice(0, 10) < gun).reduce((s, x) => s + kurusa(x.giris) - kurusa(x.cikis), 0);
  const giris = bugun.reduce((s, x) => s + kurusa(x.giris), 0);
  const cikis = bugun.reduce((s, x) => s + kurusa(x.cikis), 0);
  return { acilis: acilis / 100, giris: giris / 100, cikis: cikis / 100, kapanis: (acilis + giris - cikis) / 100 };
}

/** Kasayı kim görür / kullanır: Genel Merkez yalnızca genel yönetici; şube kasası şube kapsamındakiler */
export function kasaErisimi(kasa: string, secenek: { genel: boolean; kapsam: string[] }): boolean {
  const s = kasaSubesi(kasa);
  return s === MERKEZ ? secenek.genel : secenek.genel || secenek.kapsam.includes(s);
}

export const GIDER_KATEGORILERI = ["Kira", "Fatura", "Maaş", "Kırtasiye", "Yazılım", "Reklam", "Temizlik", "Diğer"];

/**
 * Gider: finans açık; tutar; tarih bugünden sonra olamaz; kasa türü; kategori ve açıklama dolu;
 * Genel Merkez (ortak) gideri yalnızca genel yönetici. Girilen gider değiştirilemez / silinemez; yalnızca yönetici
 * gerekçeyle iptal eder (karar 2026-11-08, finansIptalEngeli).
 */
export function giderEngeli(
  g: Gider,
  eski: Gider | undefined,
  d: Pick<Db, "subeler">,
  secenek: { finans: boolean; genel: boolean; bugun: string; rol?: Rol },
): Hata {
  if (!secenek.finans) return "Finans modülü kapalıyken gider girilemez veya iptal edilemez.";
  if (eski) return finansIptalEngeli(eski, g, secenek.rol ?? "sekreter", "Gider");
  if (!g || typeof g !== "object") return "Gider bilgisi geçersiz.";
  if (g.iptal) return "Yeni gider iptal edilmiş olarak girilemez.";
  if (!tutarGecerli(g.tutar)) return "Gider tutarı sıfırdan büyük, kuruş hassasiyetinde olmalı.";
  if (!isoTarihMi(g.tarih)) return "Gider tarihi geçersiz.";
  if (g.tarih > secenek.bugun) return "Gider tarihi bugünden sonra olamaz.";
  if (!(KASA_TURLERI as string[]).includes(g.kasa)) return "Kasa türü geçersiz.";
  if (typeof g.kategori !== "string" || !g.kategori.trim()) return "Gider kategorisi seçilmeli.";
  if (typeof g.aciklama !== "string" || !g.aciklama.trim()) return "Gider açıklaması boş olamaz.";
  if (g.subeId === MERKEZ) return secenek.genel ? null : "Genel Merkez gideri yalnızca genel yönetici tarafından girilir.";
  if (!d.subeler.some((s) => s.id === g.subeId)) return "Giderin şubesi bulunamadı.";
  return null;
}

/**
 * Virman: finans açık; iki geçerli ve farklı kasa; tutar; tarih bugünden sonra olamaz; Genel Merkez kasasından
 * yalnızca genel yönetici; kaynak kasada yeterli bakiye olmalı. Girilen virman değiştirilemez / silinemez.
 */
export function virmanEngeli(
  v: Virman,
  eski: Virman | undefined,
  d: Pick<Db, "subeler">,
  secenek: { finans: boolean; genel: boolean; bugun: string; bakiye: (kasa: string) => number; rol?: Rol },
): Hata {
  if (!secenek.finans) return "Finans modülü kapalıyken virman yapılamaz veya iptal edilemez.";
  if (eski) return finansIptalEngeli(eski, v, secenek.rol ?? "sekreter", "Virman");
  if (!v || typeof v !== "object") return "Virman bilgisi geçersiz.";
  if (v.iptal) return "Yeni virman iptal edilmiş olarak girilemez.";
  if (!kasaGecerli(v.kaynak, d.subeler) || !kasaGecerli(v.hedef, d.subeler)) return "Kaynak veya hedef kasa geçersiz.";
  if (v.kaynak === v.hedef) return "Kaynak ve hedef kasa aynı olamaz.";
  if (!tutarGecerli(v.tutar)) return "Virman tutarı sıfırdan büyük, kuruş hassasiyetinde olmalı.";
  if (!isoTarihMi(v.tarih) || v.tarih > secenek.bugun) return "Virman tarihi geçersiz veya bugünden sonra.";
  if (kasaSubesi(v.kaynak) === MERKEZ && !secenek.genel) return "Genel Merkez kasasından yalnızca genel yönetici virman yapabilir.";
  if (kurusa(secenek.bakiye(v.kaynak)) < kurusa(v.tutar)) return "Kaynak kasada yeterli bakiye yok.";
  return null;
}

/* =========================== Özet ve listeler =========================== */
/** Oran (%), payda sıfırsa 0 */
export const yuzde = (pay: number, payda: number) => (payda > 0 ? Math.round((pay / payda) * 100) : 0);

/** Taksitlerin beklenen ve tahsil edilen toplamı (kuruş yuvarlamalı) */
export function beklenenTahsil(taksitler: Pick<Taksit, "tutar" | "odenen">[]) {
  return {
    beklenen: taksitler.reduce((s, t) => s + kurusa(t.tutar), 0) / 100,
    tahsil: taksitler.reduce((s, t) => s + kurusa(t.odenen), 0) / 100,
  };
}

/** Sezonun ayları (YYYY-AA), başlangıçtan bitişe; en fazla 12 ay */
export function sezonAylari(sezon: { baslangic: string; bitis: string } | undefined): string[] {
  if (!sezon || !isoTarihMi(sezon.baslangic) || !isoTarihMi(sezon.bitis)) return [];
  const aylar: string[] = [];
  let [y, m] = sezon.baslangic.split("-").map(Number);
  const son = sezon.bitis.slice(0, 7);
  while (aylar.length < 12) {
    const a = `${y}-${String(m).padStart(2, "0")}`;
    if (a > son) break;
    aylar.push(a);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return aylar;
}

/** Vadesi geçmiş, kalanı olan taksitler */
export const vadesiGecenler = <T extends Taksit>(taksitler: T[], bugun: string) => taksitler.filter((t) => t.vade < bugun && kalan(t) > 0);
