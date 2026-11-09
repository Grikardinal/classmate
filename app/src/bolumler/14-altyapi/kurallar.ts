/**
 * Bölüm 14 · Saf iş kuralları (ekran ve sunucu ortak; yalnızca göreli içe aktarma).
 * Yedek biçimi, üretim yapılandırması, ayar sınırları, Excel içe aktarma ve KVKK anonimleştirme.
 */
import { islemYaz, taksitKalan, yeniId, type Aday, type Ayarlar, type Db, type IceAktarma, type Ogrenci, type Rol, type Veli } from "../../data/model";
import { KOLEKSIYONLAR, anahtar, type Degisiklik, type Koleksiyon } from "../../data/fark";
import {
  adSoyadBol,
  anonimlestir,
  epostaGecerli,
  gorevCoz,
  gunFarki,
  mukerrerMi,
  normalAd,
  satirCoz,
  sozlesmeNo,
  telefonNormalize,
  type IceAktarmaAlani,
  type IceAktarmaSatiri,
  type PersonelAlani,
} from "../../lib/kurallar";
import { ayniEposta, epostaNormalize, parolaKurali } from "../02-kullanicilar/kurallar";
import { ANONIM_TELEFON, anonimMi } from "../03-on-kayit/kurallar";
import { AD_EN_FAZLA, OKUL_EN_FAZLA, grupAktifSayisi, ogrenciAnonimMi, sozlesmeYili, veliAnonimMi } from "../04-ogrenciler/kurallar";
import { ogrencileriCikar } from "../09-etut/kurallar";

export type Hata = string | null;
type Nesne = Record<string, unknown>;
const nesneMi = (x: unknown): x is Nesne => !!x && typeof x === "object" && !Array.isArray(x);

/* =========================== Yedek =========================== */
export const YEDEK_SAKLAMA_GUN = 30;
/** Geri yükleme isteğinin üst sınırı (genel istek sınırı 8 MB'tır; tam yedek ondan büyük olabilir) */
export const YEDEK_EN_BUYUK_BAYT = 64 * 1024 * 1024;
const YEDEK_ADI = /^classmate-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}\.json$/;

/** Yalnızca sunucunun ürettiği ad biçimi kabul edilir: yol geçişi (../) bu kalıba uymaz */
export const yedekAdiGecerli = (ad: string) => YEDEK_ADI.test(ad);
export const yedekAdiUret = (z: Date) => `classmate-${z.toISOString().slice(0, 16).replace(":", "-")}.json`;
export const yedekSuresiDoldu = (zamanIso: string, simdiMs: number, saklaGun = YEDEK_SAKLAMA_GUN) => simdiMs - new Date(zamanIso).getTime() > saklaGun * 86400_000;

const ZORUNLU_TEKIL = ["kurum", "moduller", "ayarlar", "rolYetkileri"] as const;
const ZORUNLU_KOLEKSIYON: Koleksiyon[] = ["subeler", "sezonlar", "personel", "kullanicilar", "veliler", "ogrenciler", "kayitlar"];
export const YEDEK_GECERSIZ = "Geçerli bir Classmate yedeği değil (veya farklı sürüm).";

/**
 * Yedek dosyasının biçim denetimi. Yazma adımı başlamadan bozuk dosya elenir:
 * kurum kaydı olmayan yedek veritabanına yazılsaydı sonraki açılışta "kurulum yapılmamış" sayılırdı.
 */
export function yedekDogrula(ham: unknown, surum: number): Hata {
  if (!nesneMi(ham) || ham.surum !== surum) return YEDEK_GECERSIZ;
  for (const t of ZORUNLU_TEKIL) if (!nesneMi(ham[t])) return YEDEK_GECERSIZ;
  if (typeof (ham.kurum as Nesne).ad !== "string") return YEDEK_GECERSIZ;
  for (const k of ZORUNLU_KOLEKSIYON) if (!Array.isArray(ham[k])) return YEDEK_GECERSIZ;
  for (const k of KOLEKSIYONLAR) {
    const v = ham[k];
    if (v === undefined) continue;
    const satirlar = Array.isArray(v) ? v : k === "yoklamalar" && nesneMi(v) ? Object.values(v) : null;
    if (!satirlar) return YEDEK_GECERSIZ;
    const gorulen = new Set<string>();
    for (const s of satirlar) {
      if (!nesneMi(s)) return `Yedekte bozuk satır var (${k}).`;
      const a = anahtar(k, s);
      if (!a || a === "undefined" || a === "null") return `Yedekte kimliksiz satır var (${k}).`;
      if (gorulen.has(a)) return `Yedekte aynı kimlikli iki satır var (${k}).`;
      gorulen.add(a);
    }
  }
  return null;
}

/** Sonradan eklenen alanlar eski yedekte yoksa boş değerle tamamlanır (doğrulamadan geçmiş yedek için) */
export function yedekTamamla(y: Db): Db {
  const sonuc = { ...y } as unknown as Nesne;
  for (const k of KOLEKSIYONLAR) if (sonuc[k] === undefined) sonuc[k] = k === "yoklamalar" ? {} : [];
  sonuc.fiyatListesi ??= [];
  sonuc.hakedisDurum ??= {};
  sonuc.otomasyon ??= {};
  return sonuc as unknown as Db;
}

/**
 * Yedekten dönüş, KVKK kapsamında silinmiş kişiyi geri getirmesin: mevcut veride anonim olup yedekte açık duran
 * öğrenci, veli ve aday yeniden anonimleştirilir; yedekten sonraki KVKK başvuru kayıtları korunur.
 */
export function anonimlikleriKoru(mevcut: Db, yedek: Db, bugun: string): { db: Db; sayi: number } {
  const x = { ...yedek } as Db;
  let sayi = 0;
  for (const o of yedek.ogrenciler) {
    const m = mevcut.ogrenciler.find((y) => y.id === o.id);
    if (m && ogrenciAnonimMi(m) && !ogrenciAnonimMi(o)) {
      ogrenciMaskele(x, o.id, bugun);
      sayi++;
    }
  }
  for (const v of yedek.veliler) {
    const m = mevcut.veliler.find((y) => y.id === v.id);
    if (m && veliAnonimMi(m) && !veliAnonimMi(v)) {
      veliMaskele(x, v.id);
      sayi++;
    }
  }
  for (const a of yedek.adaylar) {
    const m = mevcut.adaylar.find((y) => y.id === a.id);
    if (m && anonimMi(m) && !anonimMi(a)) {
      adayMaskele(x, a.id);
      sayi++;
    }
  }
  const eksikKvkk = mevcut.kvkk.filter((k) => !yedek.kvkk.some((y) => y.id === k.id));
  if (eksikKvkk.length) x.kvkk = [...eksikKvkk, ...yedek.kvkk];
  return { db: x, sayi };
}

/* =========================== Üretim yapılandırması =========================== */
/** DEMO açıkça "1"/"0" ise ona uyulur; tanımsızsa yalnızca geliştirmede demo: üretimde yanlışlıkla bilinen parolalı demoyla açılmaz */
export function demoModu(deger: string | undefined, uretim: boolean): boolean {
  if (deger === "1") return true;
  if (deger === "0") return false;
  return !uretim;
}

export function ilkParolaEngeli(parola: string | undefined): Hata {
  if (!parola) return "Demo dışı ilk kurulum için ILK_YONETICI_PAROLA gerekli";
  const kural = parolaKurali(parola);
  return kural ? `ILK_YONETICI_PAROLA uygun değil: ${kural}` : null;
}

/** Açılışta günlüğe yazılan uyarılar (sır içermez) */
export function uretimUyarilari(s: { uretim: boolean; demo: boolean; sms: string; postgres: boolean }): string[] {
  if (!s.uretim) return [];
  if (s.demo) return ["DEMO açık: uygulama bilinen parolalı örnek veriyle çalışıyor. Gerçek kurum verisi girmeyin."];
  const l: string[] = [];
  if (s.sms === "konsol") l.push("SMS_SAGLAYICI=konsol: SMS gönderilmiyor; veli girişi ve iki adımlı doğrulama çalışmaz.");
  if (!s.postgres) l.push("DATABASE_URL yok: gömülü veritabanı kullanılıyor; kalıcı disk ve ayrı yedek olmadan veri kaybı riski var.");
  return l;
}

/** İçerik türünün kendisi JSON olmalı: "text/plain; application/json" gibi çapraz siteden gönderilebilen değerler geçmez */
export const jsonIcerikMi = (baslik: string | undefined) => (baslik ?? "").split(";")[0].trim().toLowerCase() === "application/json";

/** /api/degisiklik paketinin biçimi; içerik denetimi yazmaDenetle'dedir */
export function degisiklikPaketiEngeli(ham: unknown): Hata {
  const H = "Geçersiz değişiklik paketi";
  if (!nesneMi(ham) || !nesneMi(ham.koleksiyonlar) || !nesneMi(ham.tekil)) return H;
  for (const v of Object.values(ham.koleksiyonlar)) {
    if (!nesneMi(v)) return H;
    if (v.yaz !== undefined && !(Array.isArray(v.yaz) && v.yaz.every(nesneMi))) return H;
    if (v.sil !== undefined && !(Array.isArray(v.sil) && v.sil.every((x) => typeof x === "string"))) return H;
  }
  return null;
}

/* =========================== Sistem ayarları =========================== */
export const AYAR_SINIRLARI = {
  devamsizlikEsigi: { en: 1, enCok: 50, ad: "Devamsızlık eşiği" },
  subeGecisDk: { en: 0, enCok: 240, ad: "Şubeler arası geçiş süresi" },
  yoklamaHatirlatmaDk: { en: 0, enCok: 240, ad: "Yoklama hatırlatma süresi" },
  etutIptalSaat: { en: 0, enCok: 168, ad: "Etüt iptal süresi" },
  saklamaAyAday: { en: 1, enCok: 120, ad: "Aday saklama süresi" },
  saklamaAyOgrenci: { en: 1, enCok: 120, ad: "Öğrenci saklama süresi" },
  oturumGun: { en: 1, enCok: 365, ad: "Veli oturum süresi" },
} as const;

/** Değişen ayarların sınırı: saklama süresi 0 olsa adaylar hemen "süresi dolmuş" sayılırdı (eski veride geçersiz kalmış alan kilitlemez) */
export function ayarlarEngeli(yeni: unknown, eski: Ayarlar): Hata {
  if (!nesneMi(yeni)) return "Geçersiz ayar.";
  for (const [k, s] of Object.entries(AYAR_SINIRLARI) as [keyof typeof AYAR_SINIRLARI, (typeof AYAR_SINIRLARI)[keyof typeof AYAR_SINIRLARI]][]) {
    const v = yeni[k];
    if (v === eski[k]) continue;
    if (typeof v !== "number" || !Number.isInteger(v) || v < s.en || v > s.enCok) return `${s.ad} ${s.en} ile ${s.enCok} arasında tam sayı olmalı.`;
  }
  if (typeof yeni.gelmeyenHakDussun !== "boolean") return "Geçersiz ayar.";
  if (yeni.kvkkOtomatik !== undefined && typeof yeni.kvkkOtomatik !== "boolean") return "Geçersiz ayar.";
  const g = yeni.hatirlatmaGunleri;
  if (JSON.stringify(g) !== JSON.stringify(eski.hatirlatmaGunleri)) {
    if (!Array.isArray(g) || !g.length || g.length > 10 || !g.every((x) => Number.isInteger(x) && x >= -60 && x <= 365)) return "Taksit hatırlatma günleri −60 ile 365 arasında, en çok 10 tam sayı olmalı.";
  }
  return null;
}

/* =========================== Excel içe aktarma =========================== */
export const DOSYA_EN_BUYUK_BAYT = 10 * 1024 * 1024;
/** Tek pakette sunucunun 8 MB istek sınırına sığar */
export const AKTARIM_EN_FAZLA_SATIR = 5000;

export function aktarimTablosuEngeli(satirSayisi: number): Hata {
  if (satirSayisi < 2) return "Dosyada başlık satırı ve en az bir veri satırı olmalı.";
  if (satirSayisi - 1 > AKTARIM_EN_FAZLA_SATIR) return `Bir seferde en çok ${AKTARIM_EN_FAZLA_SATIR} satır aktarılabilir; dosyayı bölün.`;
  return null;
}
export const dosyaBoyutEngeli = (bayt: number): Hata => (bayt > DOSYA_EN_BUYUK_BAYT ? "Dosya 10 MB'tan büyük olamaz." : null);

/** Sütundaki doğum tarihi: YYYY-AA-GG veya GG.AA.YYYY; okunamayan veya gelecekteki tarih boş bırakılır */
export function dogumCoz(ham: string, bugun: string): string | null {
  const m = ham.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  const iso = m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : ham.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || iso > bugun) return null;
  const t = new Date(iso + "T00:00:00");
  return !Number.isNaN(t.getTime()) && t.toISOString().length > 0 && Number(iso.slice(8)) === t.getDate() ? iso : null;
}

export type OnizlemeSatiri = IceAktarmaSatiri & { subeId: string | null; grupId: string | null; mukerrer: boolean; kardesVeliId: string | null };
export type OnizlemeSecenek = {
  eslesme: Partial<Record<IceAktarmaAlani, number>>;
  subeModu: "sabit" | "sutun";
  sabitSube: string;
  grupModu: "sutun" | "seviye";
  kapsam: string[];
  sezonId: string;
  bugun: string;
};

/** Sihirbazın 4. adımı: satır satır doğrulama */
export function ogrenciOnizleme(d: Pick<Db, "ogrenciler" | "veliler" | "gruplar" | "subeler" | "kayitlar">, veri: string[][], o: OnizlemeSecenek): OnizlemeSatiri[] {
  const veliMap = new Map(d.veliler.map((v) => [v.id, v]));
  const mevcut = d.ogrenciler.map((x) => ({ ad: x.ad, soyad: x.soyad, veliTelefonlari: x.veliIds.map((id) => veliMap.get(id)?.telefon ?? "").filter(Boolean) }));
  const dosyadaki: { ad: string; soyad: string; veliTelefonlari: string[] }[] = [];
  const doluluk = new Map<string, number>();
  return veri.map((satir, i) => {
    const s = satirCoz(satir, o.eslesme, i + 2);
    if (s.ad.length > AD_EN_FAZLA || s.soyad.length > AD_EN_FAZLA) s.hatalar.push("Ad veya soyad çok uzun");
    if (s.okul.length > OKUL_EN_FAZLA) s.hatalar.push("Okul adı çok uzun");
    if (s.dogum) {
      const dogum = dogumCoz(s.dogum, o.bugun);
      if (!dogum) s.uyarilar.push("Doğum tarihi okunamadı; boş aktarılacak");
      s.dogum = dogum ?? "";
    }
    let subeId: string | null = o.subeModu === "sabit" ? o.sabitSube : null;
    if (o.subeModu === "sutun") {
      const n = normalAd(s.subeAdi);
      subeId = d.subeler.find((x) => normalAd(x.ad) === n || normalAd(x.kod) === n || (n && normalAd(x.ad).startsWith(n)))?.id ?? null;
      if (!subeId) s.hatalar.push(s.subeAdi ? `Tanımsız şube: ${s.subeAdi}` : "Şube boş");
      else if (!o.kapsam.includes(subeId)) {
        s.hatalar.push("Şube kapsamınız dışında");
        subeId = null;
      }
    }
    let grupId: string | null = null;
    if (subeId) {
      const gruplar = d.gruplar.filter((g) => g.subeId === subeId && g.sezonId === o.sezonId);
      if (o.grupModu === "sutun") {
        const n = normalAd(s.grupAdi.replace(/^[a-zçğıöşü]{3}\s+/i, ""));
        grupId = gruplar.find((g) => normalAd(g.ad) === n)?.id ?? null;
        if (!grupId) s.hatalar.push(s.grupAdi ? `Tanımsız grup: ${s.grupAdi}` : "Grup boş");
        else if (s.seviye && gruplar.find((g) => g.id === grupId)!.seviye !== s.seviye) s.uyarilar.push("Grup seviyesi sınıfla uyuşmuyor");
      } else if (s.seviye) {
        grupId = gruplar.find((g) => g.seviye === s.seviye)?.id ?? null;
        if (!grupId) s.hatalar.push(`${d.subeler.find((x) => x.id === subeId)?.kod} şubesinde ${s.seviye}. sınıf grubu yok`);
      }
    }
    const aday = { ad: s.ad, soyad: s.soyad, veliTelefon: s.veliTelefon ?? "" };
    const mukerrer = !!s.ad && !!s.veliTelefon && (mukerrerMi(aday, mevcut) || mukerrerMi(aday, dosyadaki));
    if (mukerrer) s.hatalar.push("Mükerrer öğrenci (aynı ad + veli telefonu)");
    if (s.ad && s.veliTelefon) dosyadaki.push({ ad: s.ad, soyad: s.soyad, veliTelefonlari: [s.veliTelefon] });
    // Kapasite: yalnızca aktarılacak satırlar sayılır; aşım engel değil uyarıdır (kapasite aşımını onaylayan roller aktarır)
    if (grupId && !s.hatalar.length) {
      const dolu = doluluk.get(grupId) ?? grupAktifSayisi(d, grupId);
      doluluk.set(grupId, dolu + 1);
      const kapasite = d.gruplar.find((g) => g.id === grupId)!.kapasite;
      if (dolu + 1 > kapasite) s.uyarilar.push(`Grup kapasitesi aşılıyor (${dolu + 1}/${kapasite})`);
    }
    const kardesVeliId = s.veliTelefon ? d.veliler.find((v) => telefonNormalize(v.telefon) === s.veliTelefon)?.id ?? null : null;
    return { ...s, subeId, grupId, mukerrer, kardesVeliId };
  });
}

type AktarimBaglami = { partiId: string; dosya: string; kullanici: string; atlanan: number; bugun: string; zaman: string };

/** Geçerli satırları taslağa yazar; kardeşler aynı veli telefonundan eşleşir. Sözleşme yılı aktarılan sezondan gelir. */
export function ogrenciAktarimiUygula(x: Db, gecerli: OnizlemeSatiri[], sezonId: string, b: AktarimBaglami): string[] {
  const ogrenciIds: string[] = [];
  const veliIds: string[] = [];
  const kayitIds: string[] = [];
  const yil = sozlesmeYili(x.sezonlar, sezonId, b.bugun);
  const telVeli = new Map(x.veliler.map((v) => [telefonNormalize(v.telefon), v.id]));
  for (const s of gecerli) {
    let vid = telVeli.get(s.veliTelefon!);
    if (!vid) {
      vid = yeniId("v");
      x.veliler.push({ id: vid, ad: s.veliAd || "Veli", soyad: s.veliSoyad, telefon: s.veliTelefon!, eposta: "", yakinlik: "Diğer", pushAcik: false, portalDavet: "bekliyor", izinSms: true, izinTanitim: false });
      telVeli.set(s.veliTelefon!, vid);
      veliIds.push(vid);
    }
    const oid = yeniId("o");
    x.ogrenciler.push({ id: oid, ad: s.ad, soyad: s.soyad, dogum: s.dogum, cinsiyet: "K", okul: s.okul, okulSinifi: "", saglikNotu: "", veliIds: [vid], birincilVeliId: vid, durum: "aktif", notlar: [], iceAktarmaId: b.partiId });
    const kid = yeniId("k");
    const kod = x.subeler.find((z) => z.id === s.subeId)!.kod;
    x.kayitlar.push({
      id: kid, ogrenciId: oid, sezonId, subeId: s.subeId!, grupId: s.grupId!, sozlesmeNo: sozlesmeNo(kod, yil, x.kayitlar.map((k) => k.sozlesmeNo)),
      durum: "aktif", tarih: b.bugun, grupGecmisi: [{ grupId: s.grupId!, tarih: b.bugun }], ekHizmetler: [], kvkkOnay: null, listeFiyati: 0, indirimler: [], net: 0, iceAktarmaId: b.partiId,
    });
    ogrenciIds.push(oid);
    kayitIds.push(kid);
  }
  x.iceAktarmalar.unshift({ id: b.partiId, zaman: b.zaman, dosya: b.dosya, ogrenciIds, veliIds, kayitIds, atlanan: b.atlanan, geriAlindi: false });
  islemYaz(x, b.kullanici, "Excel içe aktarma", `${b.dosya}: ${ogrenciIds.length} öğrenci eklendi, ${b.atlanan} satır atlandı`);
  return ogrenciIds;
}

/** Aktarımdan sonra veri işlenmiş öğrencinin toplu silinmesi yoklama, ödeme vb. kayıtları sahipsiz bırakırdı */
export function geriAlmaEngeli(d: Pick<Db, "taksitler" | "yoklamalar" | "izinler" | "randevular" | "paketler">, p: Pick<IceAktarma, "ogrenciIds" | "geriAlindi">): Hata {
  if (p.geriAlindi) return "Bu aktarım zaten geri alındı.";
  const ids = new Set(p.ogrenciIds);
  const var_ =
    d.taksitler.some((t) => ids.has(t.ogrenciId)) ||
    Object.values(d.yoklamalar).some((y) => Object.keys(y.durumlar).some((o) => ids.has(o))) ||
    d.izinler.some((i) => ids.has(i.ogrenciId)) ||
    d.randevular.some((r) => r.ogrenciIds.some((o) => ids.has(o))) ||
    d.paketler.some((k) => ids.has(k.ogrenciId));
  return var_ ? "Aktarılan öğrencilere yoklama, ödeme veya etüt kaydı girilmiş; aktarım artık geri alınamaz." : null;
}

export function ogrenciAktarimGeriAl(x: Db, p: IceAktarma, kullanici: string) {
  const ogr = new Set(p.ogrenciIds);
  const kayit = new Set(p.kayitIds);
  x.ogrenciler = x.ogrenciler.filter((o) => !ogr.has(o.id));
  x.kayitlar = x.kayitlar.filter((k) => !kayit.has(k.id));
  // Yalnızca bu partide oluşturulan ve başka öğrenciye bağlanmamış veliler silinir
  x.veliler = x.veliler.filter((v) => !p.veliIds.includes(v.id) || x.ogrenciler.some((o) => o.veliIds.includes(v.id)));
  x.iceAktarmalar = x.iceAktarmalar.map((y) => (y.id === p.id ? { ...y, geriAlindi: true } : y));
  islemYaz(x, kullanici, "İçe aktarma geri alındı", `${p.dosya}: ${p.ogrenciIds.length} öğrenci silindi`);
}

export type PersonelSatiri = {
  satirNo: number; ad: string; soyad: string; rol: Rol | null; telefon: string | null; eposta: string;
  subeIds: string[]; dersIds: string[]; hatalar: string[]; uyarilar: string[];
};

export function personelOnizleme(d: Pick<Db, "subeler" | "dersler" | "personel" | "kullanicilar">, veri: string[][], eslesme: Partial<Record<PersonelAlani, number>>, kapsam: string[], hesapAc: boolean): PersonelSatiri[] {
  const al = (s: string[], k: PersonelAlani) => (eslesme[k] !== undefined ? String(s[eslesme[k]!] ?? "").trim() : "");
  const gorulenTel = new Set<string>();
  const gorulenEposta = new Set<string>();
  return veri.map((s, i) => {
    const { ad: a, soyad } = adSoyadBol(al(s, "adSoyad"));
    const rol = gorevCoz(al(s, "gorev"));
    const telHam = al(s, "telefon");
    const telefon = telefonNormalize(telHam);
    const eposta = epostaNormalize(al(s, "eposta"));
    const subeAdlari = al(s, "sube").split(/[,;/]/).map((x) => normalAd(x)).filter(Boolean);
    const subeIds = subeAdlari.map((n) => d.subeler.find((x) => normalAd(x.ad) === n || normalAd(x.kod) === n || normalAd(x.ad).startsWith(n))?.id).filter(Boolean) as string[];
    const bransAdlari = al(s, "brans").split(/[,;/]/).map((x) => normalAd(x)).filter(Boolean);
    const dersIds = bransAdlari.map((n) => d.dersler.find((x) => normalAd(x.ad) === n || normalAd(x.kisaAd) === n)?.id).filter(Boolean) as string[];
    const hatalar: string[] = [];
    const uyarilar: string[] = [];
    if (!a || !soyad) hatalar.push("Ad ve soyad gerekli");
    if (!rol) hatalar.push(al(s, "gorev") ? `Tanınmayan görev: ${al(s, "gorev")}` : "Görev boş");
    else if (rol === "genel-yonetici") hatalar.push("Genel yönetici içe aktarılamaz");
    if (!telHam) hatalar.push("Telefon boş");
    else if (!telefon) hatalar.push(`Hatalı telefon: ${telHam}`);
    if (eposta && !epostaGecerli(eposta)) hatalar.push(`Hatalı e-posta: ${eposta}`);
    if (hesapAc && !eposta) uyarilar.push("E-posta yok; kullanıcı hesabı açılmayacak");
    if (subeAdlari.length !== subeIds.length) hatalar.push("Tanımsız şube");
    if (!subeIds.length) subeIds.push(kapsam[0]);
    if (subeIds.some((x) => !kapsam.includes(x))) hatalar.push("Şube kapsamınız dışında");
    if (bransAdlari.length !== dersIds.length) uyarilar.push("Bazı branşlar tanınmadı");
    if (telefon && (gorulenTel.has(telefon) || d.personel.some((p) => p.telefon === telefon))) hatalar.push("Bu telefonla kayıtlı personel var");
    if (eposta && (gorulenEposta.has(eposta) || d.kullanicilar.some((k) => ayniEposta(k.eposta, eposta)) || d.personel.some((p) => ayniEposta(p.eposta, eposta)))) hatalar.push("Bu e-postayla kayıtlı personel var");
    if (telefon) gorulenTel.add(telefon);
    if (eposta) gorulenEposta.add(eposta);
    return { satirNo: i + 2, ad: a, soyad, rol, telefon, eposta, subeIds, dersIds, hatalar, uyarilar };
  });
}

/* =========================== KVKK =========================== */
export const KVKK_SILINDI = "[KVKK kapsamında silindi]";

export function saklamasiDolanAdaylar(d: Pick<Db, "adaylar" | "ayarlar">, bugun: string): Aday[] {
  return d.adaylar.filter((a) => a.durum === "vazgecti" && !anonimMi(a) && gunFarki(a.olusturma, bugun) > d.ayarlar.saklamaAyAday * 30);
}

/** Ayrılma tarihi: son iptal hesabı, son grup değişikliği veya kayıt tarihinin en yenisi */
export function ayrilmaTarihi(d: Pick<Db, "kayitlar">, ogrenciId: string): string | null {
  const l = d.kayitlar.filter((k) => k.ogrenciId === ogrenciId).flatMap((k) => [k.tarih, k.iptalHesabi?.tarih, ...k.grupGecmisi.map((g) => g.tarih)]).filter((t): t is string => !!t);
  return l.length ? l.map((t) => t.slice(0, 10)).sort().at(-1)! : null;
}

export function saklamasiDolanOgrenciler(d: Pick<Db, "ogrenciler" | "kayitlar" | "ayarlar">, bugun: string): Ogrenci[] {
  return d.ogrenciler.filter((o) => {
    if (o.durum !== "ayrildi" || ogrenciAnonimMi(o)) return false;
    const t = ayrilmaTarihi(d, o.id);
    return !!t && gunFarki(t, bugun) > d.ayarlar.saklamaAyOgrenci * 30;
  });
}

/** Veri sahibi bilgi talebi için kişinin tüm kaydı */
export function kisiDokumu(d: Db, tur: "veli" | "ogrenci", id: string) {
  if (tur === "veli") {
    const veli = d.veliler.find((v) => v.id === id);
    const tel = veli && telefonNormalize(veli.telefon);
    return { veli, cocuklar: d.ogrenciler.filter((o) => o.veliIds.includes(id)), adaylar: d.adaylar.filter((a) => !!tel && telefonNormalize(a.veliTelefon) === tel), izinler: d.izinler.filter((i) => i.veliId === id), mesajlar: d.gonderimler.filter((g) => g.veliId === id) };
  }
  return {
    ogrenci: d.ogrenciler.find((o) => o.id === id),
    kayitlar: d.kayitlar.filter((k) => k.ogrenciId === id),
    yoklama: Object.values(d.yoklamalar).filter((y) => y.durumlar[id]).map((y) => ({ tarih: y.tarih, durum: y.durumlar[id], konu: y.konu })),
    izinler: d.izinler.filter((i) => i.ogrenciId === id),
    odemeler: d.taksitler.filter((t) => t.ogrenciId === id),
    mesajlar: d.gonderimler.filter((g) => g.ogrenciId === id),
  };
}

/** İşlem kaydı metninde geçen ad silinir; kaydın kendisi değişmez (kim, ne zaman, hangi işlem) */
function islemlerdenAdSil(x: Db, ad: string, maske: string) {
  if (ad.trim().length < 3) return;
  x.islemler = x.islemler.map((i) => (i.detay.includes(ad) || i.kullanici === ad ? { ...i, detay: i.detay.split(ad).join(maske), kullanici: i.kullanici === ad ? maske : i.kullanici } : i));
}

function gonderimleriSil(x: Db, eslesir: (g: Db["gonderimler"][number]) => boolean) {
  x.gonderimler = x.gonderimler.map((g) => {
    if (!eslesir(g)) return g;
    const silinmis = { ...g, alici: "***", metin: KVKK_SILINDI };
    // Kuyruktaki mesaj artık gönderilmez
    return g.durum === "bekliyor" ? { ...silinmis, durum: "basarisiz" as const, hata: KVKK_SILINDI } : silinmis;
  });
}

function adayMaskele(x: Db, id: string): string {
  const a = x.adaylar.find((y) => y.id === id)!;
  const veliMaske = `${anonimlestir(a.veliAd)} ***`;
  x.adaylar = x.adaylar.map((y) => (y.id === id ? { ...y, veliAd: veliMaske, veliTelefon: ANONIM_TELEFON, ogrenciAd: anonimlestir(a.ogrenciAd), okul: "", notlar: [], sonrakiAksiyon: null } : y));
  gonderimleriSil(x, (g) => g.adayId === id);
  return veliMaske;
}

function ogrenciMaskele(x: Db, id: string, bugun: string): string {
  const o = x.ogrenciler.find((y) => y.id === id)!;
  const maske = `${anonimlestir(o.ad)} ${anonimlestir(o.soyad)}`;
  x.ogrenciler = x.ogrenciler.map((y) => (y.id === id ? { ...y, ad: anonimlestir(o.ad), soyad: anonimlestir(o.soyad), dogum: "", okul: "", okulSinifi: "", saglikNotu: "", notlar: [], durum: "ayrildi" } : y));
  x.kayitlar = x.kayitlar.map((k) => (k.ogrenciId === id && k.durum !== "iptal" ? { ...k, durum: "iptal" } : k));
  x.izinler = x.izinler.map((i) => (i.ogrenciId === id ? { ...i, not: "" } : i));
  x.odevler = x.odevler.map((d) => {
    if (!d.notlar?.[id]) return d;
    const { [id]: _silinen, ...notlar } = d.notlar;
    void _silinen;
    return { ...d, notlar };
  });
  const tek = new Set([id]);
  x.randevular = x.randevular.map((r) => (r.tarih >= bugun && r.durum !== "iptal" && r.ogrenciIds.includes(id) ? ogrencileriCikar(r, tek) : r));
  for (const a of x.adaylar) if (a.ogrenciId === id && !anonimMi(a)) adayMaskele(x, a.id);
  gonderimleriSil(x, (g) => g.ogrenciId === id);
  islemlerdenAdSil(x, `${o.ad} ${o.soyad}`, maske);
  return maske;
}

function veliMaskele(x: Db, id: string): string {
  const v = x.veliler.find((y) => y.id === id)!;
  const maske = `${anonimlestir(v.ad)} ${anonimlestir(v.soyad)}`;
  const tel = telefonNormalize(v.telefon);
  x.veliler = x.veliler.map((y) => (y.id === id ? { ...y, ad: anonimlestir(v.ad), soyad: anonimlestir(v.soyad), telefon: ANONIM_TELEFON, eposta: "", pushAcik: false, izinSms: false, izinTanitim: false, portalDavet: "bekliyor" } : y));
  for (const a of x.adaylar) if (!anonimMi(a) && !!tel && telefonNormalize(a.veliTelefon) === tel) adayMaskele(x, a.id);
  gonderimleriSil(x, (g) => g.veliId === id);
  islemlerdenAdSil(x, `${v.ad} ${v.soyad}`, maske);
  return maske;
}

/** Finansı açık kurumda öğrencilerin kalan taksit toplamı (anonimleştirme öncesi uyarı) */
export function acikBorc(d: Pick<Db, "moduller" | "taksitler">, ogrenciIds: string[]): number {
  if (d.moduller?.finans !== true) return 0;
  const ids = new Set(ogrenciIds);
  const toplam = d.taksitler.filter((t) => ids.has(t.ogrenciId)).reduce((a, t) => a + Math.max(0, taksitKalan(t)), 0);
  return Math.round(toplam * 100) / 100;
}
export const tutarYazi = (n: number) => `${n.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ₺`;

/** Karar 2026-11-09: taksit, tahsilat, iade ve gider 10 yıl saklanır (mali müşavir onayı gerekiyor). Anonimleştirme tutara dokunmaz. */
export const FINANS_SAKLAMA_YIL = 10;
export type FinansSaklamaKoleksiyonu = "taksitler" | "tahsilatlar" | "iadeler" | "giderler";
export const FINANS_SAKLAMA_KOLEKSIYONLARI: readonly string[] = ["taksitler", "tahsilatlar", "iadeler", "giderler"];
/** Kaydın tarihi: taksitte vade, diğerlerinde zaman/tarih; tarihi okunamayan kayıt süresi dolmamış sayılır */
export function finansSaklamaDoldu(s: { vade?: unknown; zaman?: unknown; tarih?: unknown }, bugun: string): boolean {
  const t = String(s.vade ?? s.zaman ?? s.tarih ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return false;
  return `${Number(t.slice(0, 4)) + FINANS_SAKLAMA_YIL}${t.slice(4)}` <= bugun;
}
export const FINANS_SAKLAMA_MESAJI = `Finans kaydı ${FINANS_SAKLAMA_YIL} yıllık saklama süresi dolmadan silinemez.`;

export type KvkkTur = "ogrenci" | "veli" | "aday";

/** Sürmekte olan öğrenciye bağlı veli anonimleşirse devamsızlık ve ödeme bildirimleri kişisiz kalır: önce öğrenci sonlandırılır */
export function anonimlestirmeEngeli(d: Pick<Db, "ogrenciler" | "veliler" | "adaylar">, tur: KvkkTur, id: string): Hata {
  if (tur === "ogrenci") {
    const o = d.ogrenciler.find((y) => y.id === id);
    if (!o) return "Öğrenci bulunamadı.";
    return ogrenciAnonimMi(o) ? "Bu öğrenci zaten anonimleştirilmiş." : null;
  }
  if (tur === "aday") {
    const a = d.adaylar.find((y) => y.id === id);
    if (!a) return "Aday bulunamadı.";
    return anonimMi(a) ? "Bu aday zaten anonimleştirilmiş." : null;
  }
  const v: Veli | undefined = d.veliler.find((y) => y.id === id);
  if (!v) return "Veli bulunamadı.";
  if (veliAnonimMi(v)) return "Bu veli zaten anonimleştirilmiş.";
  if (d.ogrenciler.some((o) => o.veliIds.includes(id) && o.durum === "aktif" && !ogrenciAnonimMi(o))) return "Velinin aktif öğrencisi var. Önce öğrenciyi anonimleştirin veya kaydını sonlandırın.";
  return null;
}

const KVKK_TUR_ADI: Record<KvkkTur, string> = { ogrenci: "Öğrenci", veli: "Veli", aday: "Aday" };

/** Hepsi ya da hiçbiri: engel varsa taslağa dokunulmaz. Sunucuda çalışır (gönderim ve işlem kaydını yalnızca sunucu değiştirebilir). */
export function kvkkAnonimlestir(x: Db, tur: KvkkTur, ids: string[], b: { kullanici: string; bugun: string; zaman: string; borcOnay?: boolean; yalnizSayi?: boolean }): { engel: Hata; sayi: number } {
  const tekil = [...new Set(ids)];
  for (const id of tekil) {
    const engel = anonimlestirmeEngeli(x, tur, id);
    if (engel) return { engel, sayi: 0 };
  }
  const borc = tur === "ogrenci" ? acikBorc(x, tekil) : 0;
  if (borc > 0 && b.borcOnay !== true) return { engel: `Açık borç var (${tutarYazi(borc)}). Devam etmek için borcu görüp açıkça onaylamalısınız.`, sayi: 0 };
  let son = "";
  for (const id of tekil) son = tur === "ogrenci" ? ogrenciMaskele(x, id, b.bugun) : tur === "veli" ? veliMaskele(x, id) : adayMaskele(x, id);
  x.kvkk.unshift({ id: yeniId("kv"), zaman: b.zaman, kisi: tekil.length === 1 && !b.yalnizSayi ? son : `${tekil.length} ${KVKK_TUR_ADI[tur].toLocaleLowerCase("tr-TR")}`, tur: "silme", durum: "tamamlandi", not: "Kişisel veriler anonimleştirildi; istatistikler korundu." });
  islemYaz(x, b.kullanici, "KVKK silme", `${tekil.length} ${KVKK_TUR_ADI[tur].toLocaleLowerCase("tr-TR")} verisi anonimleştirildi${borc > 0 ? `; ${tutarYazi(borc)} açık borç yönetici onayıyla, tutar korunarak` : ""}`);
  return { engel: null, sayi: tekil.length };
}

/* ---------- Haftalık otomatik anonimleştirme ---------- */
/** Tek çalıştırmada en çok bu kadar kişi; kalanlar sonraki hafta */
export const KVKK_OTOMATIK_SINIR = 500;
export const KVKK_OTOMATIK_ANAHTAR = "kvkkOtomatik";
export const KVKK_OTOMATIK_ARALIK_GUN = 7;
export const kvkkOtomatikAcik = (d: Pick<Db, "ayarlar">) => d.ayarlar.kvkkOtomatik !== false;
export function kvkkOtomatikZamani(d: Pick<Db, "otomasyon">, bugun: string): boolean {
  const son = d.otomasyon?.[KVKK_OTOMATIK_ANAHTAR];
  return !son || gunFarki(son, bugun) >= KVKK_OTOMATIK_ARALIK_GUN;
}

/** Otomatik işte borç, finans modülü kapalı olsa da aranır: geri alınamaz işlemde şüphe yöneticiye kalır */
const kayitliBorc = (d: Pick<Db, "taksitler">, id: string) => d.taksitler.filter((t) => t.ogrenciId === id).reduce((a, t) => a + Math.max(0, taksitKalan(t)), 0);

export type ElleBekleyen = { id: string; ad: string; borc: number };
export type OtomatikPlan = { ogrenciIds: string[]; adayIds: string[]; veliIds: string[]; elleBekleyen: ElleBekleyen[] };

/**
 * Süresi dolan ayrılan öğrenci ve vazgeçen aday (saklamasiDolan* hesabı). İşlenmeyenler:
 * süren kaydı olan öğrenci; borçlu öğrenci (elleBekleyen). Veli yalnızca tüm çocukları anonimse,
 * kendisine bağlı borç ve açık adayı yoksa anonimleşir: kardeşi süren veli kalır.
 */
export function otomatikAnonimlestirmePlani(d: Db, bugun: string, sinir = KVKK_OTOMATIK_SINIR): OtomatikPlan {
  const elleBekleyen: ElleBekleyen[] = [];
  const uygun: string[] = [];
  for (const o of saklamasiDolanOgrenciler(d, bugun)) {
    if (d.kayitlar.some((k) => k.ogrenciId === o.id && (k.durum === "aktif" || k.durum === "dondurulmus"))) continue;
    const borc = kayitliBorc(d, o.id);
    if (borc > 0) elleBekleyen.push({ id: o.id, ad: `${o.ad} ${o.soyad}`, borc: Math.round(borc * 100) / 100 });
    else uygun.push(o.id);
  }
  const ogrenciIds = uygun.slice(0, sinir);
  const adayIds = saklamasiDolanAdaylar(d, bugun).map((a) => a.id).slice(0, Math.max(0, sinir - ogrenciIds.length));
  const islenen = new Set(ogrenciIds);
  const islenenAday = new Set(adayIds);
  const adayler = new Set(ogrenciIds.flatMap((id) => d.ogrenciler.find((o) => o.id === id)!.veliIds));
  const kalan = Math.max(0, sinir - ogrenciIds.length - adayIds.length);
  const veliIds = [...adayler]
    .filter((vid) => {
      const v = d.veliler.find((y) => y.id === vid);
      if (!v || veliAnonimMi(v)) return false;
      if (d.ogrenciler.some((o) => o.veliIds.includes(vid) && !islenen.has(o.id) && !ogrenciAnonimMi(o))) return false;
      if (d.taksitler.some((t) => t.veliId === vid && taksitKalan(t) > 0)) return false;
      const tel = telefonNormalize(v.telefon);
      return !d.adaylar.some((a) => !anonimMi(a) && !islenenAday.has(a.id) && a.ogrenciId === undefined && !!tel && telefonNormalize(a.veliTelefon) === tel);
    })
    .slice(0, kalan);
  return { ogrenciIds, adayIds, veliIds, elleBekleyen };
}

/** Planı ortak anonimleştirmeyle uygular; kayıtlara yalnızca sayı yazılır. Öğrenci önce: veli engeli çocuklara bakar. */
export function kvkkOtomatikUygula(x: Db, plan: OtomatikPlan, b: { bugun: string; zaman: string }): { ogrenci: number; aday: number; veli: number } {
  const ortak = { kullanici: "Sistem", bugun: b.bugun, zaman: b.zaman, yalnizSayi: true };
  const calistir = (tur: KvkkTur, ids: string[]) => (ids.length ? kvkkAnonimlestir(x, tur, ids, ortak).sayi : 0);
  return { ogrenci: calistir("ogrenci", plan.ogrenciIds), aday: calistir("aday", plan.adayIds), veli: calistir("veli", plan.veliIds) };
}

/* =========================== Yazma denetimi için paket kuralları =========================== */
/** Yeni partinin zamanı sunucudan; mevcut partide yalnızca geriAlindi false → true olabilir */
export function iceAktarmaSatirEngeli(s: IceAktarma, eski: IceAktarma | undefined): Hata {
  if (!eski) return s.geriAlindi ? "Yeni aktarım geri alınmış olamaz." : null;
  if (eski.geriAlindi && !s.geriAlindi) return "Geri alınan aktarım yeniden açılamaz.";
  return JSON.stringify({ ...eski, geriAlindi: s.geriAlindi }) === JSON.stringify(s) ? null : "Aktarım kaydı değiştirilemez.";
}

export type { Degisiklik };
