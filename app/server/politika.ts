/**
 * Erişim politikası (Bölüm 02 ve 14): rol + şube kapsamı her istekte SUNUCUDA uygulanır.
 * - okumaSuz(): kullanıcıya yalnızca görebileceği satırlar gider
 * - yazmaDenetle(): her eklenen/değişen/silinen satır için rol, bölüm yetkisi, şube kapsamı ve alan kuralları
 * - veliVerisi(): veli yalnızca kendi çocuklarına ait veriyi görür
 */
import { BUGUN, aktifKayit, bildirimEkle, duyuruGonderimleri, hedefVeliler, islemYaz, smsBoyuMaliyet, taksitKalan, tamAd, type Aday, type BildirimOlayi, type Duyuru, type Db, type Ders, type Derslik, type DersSaati, type Grup, type Iptal, type Kayit, type Kullanici, type Kurum, type Ogrenci, type Personel, type HakedisDegeri, type ProgramSatiri, type Sezon, type Sube, type Tatil, type Veli, type YedekAtama } from "../src/data/model";
import {
  aktifSezonDenetle,
  dersDogrula,
  dersSaatiDogrula,
  dersSaatiSilmeEngeli,
  derslikDogrula,
  derslikSilmeEngeli,
  fiyatListesiDogrula,
  grupDogrula,
  kurumDogrula,
  programAtamaEngeli,
  sezonDogrula,
  subeDogrula,
  subePasifeAlmaEngeli,
  type Hata,
} from "../src/bolumler/01-kurum-yapisi/kurallar";
import {
  bolumYetkisi,
  epostaNormalize,
  kendiHesabiEngeli,
  kullaniciDogrula,
  rolAtamaEngeli,
  rolYetkileriDogrula,
  sonGenelYoneticiEngeli,
  yonetimEngeli,
} from "../src/bolumler/02-kullanicilar/kurallar";
import { adayYazmaEngeli, anonimMi, adTemizle, varsayilanSorumlu } from "../src/bolumler/03-on-kayit/kurallar";
import {
  adayYenidenAc,
  adayYenidenAcmaEngeli,
  bagliAday,
  iptalPaketiMi,
  kapsamDisiNakilEngeli,
  kayitYazmaEngeli,
  nakilHedefGrubu,
  ogrenciDurumu,
  ogrenciAnonimMi,
  ogrenciYazmaEngeli,
  veliAnonimMi,
  veliBirlestirmeleri,
  veliYazmaEngeli,
  yeniSozlesmeNo,
} from "../src/bolumler/04-ogrenciler/kurallar";
import {
  caymaBedeliEngeli,
  finansIptalEngeli,
  giderEngeli,
  iadeEngeli,
  iptalHesabiEngeli,
  iptalPaketOzeti,
  iptalTaksitleri,
  kasaBakiyesi,
  kasaHareketleri,
  kayitPlani,
  kayitUcretEngeli,
  kurusa,
  odemeFarklari,
  planiYenidenDagit,
  planToplamEngeli,
  tahsilatEngeli,
  tahsilatIptalEngeli,
  tahsilatKayitIptalEngeli,
  taksitYazmaEngeli,
  virmanEngeli,
  yeniMakbuzNo,
} from "../src/bolumler/05-finans/kurallar";
import { finansIslemiMi } from "../src/bolumler/12-yonetim-paneli/kurallar";
import { bransDisiAtayabilir, doluSaatleriHesapla, iptalGeriAlmaEngeli, iptalYazmaEngeli, ogretmenGruplariHesapla, oturumYedegi, programSilmeEngeli, programYazmaEngeli, tatilSilmeEngeli, tatilYazmaEngeli, yedekAtamaEngeli, yedekErisimi, yedekKaldirmaEngeli } from "../src/bolumler/06-ders-programi/kurallar";
import { GEC_YOKLAMA_GUN, kayitGrubu, devamsizlikBildirimiMi, devamsizlikOlayi, devamsizlikYineleniyor, duzeltmePlani, kaldirilanGelmeyenler, oturumBildirimleri, tarihMetni, yoklamaOturumu, yoklamaYazmaEngeli } from "../src/bolumler/07-yoklama/kurallar";
import { odevBildirimiMi, odevBildirimiYineleniyor, odevHedefleri, odevOgretmeni, odevSilmeEngeli, odevTemizle, odevYazmaEngeli, smsIzniUygula, veliOdevleri, yapmadiBildirimleri, type OdevBaglami } from "../src/bolumler/08-odevler/kurallar";
import { etutBildirimiMi, etutBildirimiYineleniyor, kalanHakUygula, kontenjanGecerli, musaitlikEngeli, ogrencileriCikar, paketBilgiMetni, paketBildirimiGitti, paketDegisimEngeli, paketYeniEngeli, randevuDurumEngeli, randevuYeniEngeli, sonucHakFarklari, veliEtutVerisi } from "../src/bolumler/09-etut/kurallar";
import { ayarEngeli, duyuruEngeli, gonderimKanali, metinEngeli, metinSablonaUyar, olayCalisir, olayUretmeYetkisi, olayYazmaEngeli, tekrarEngeli, yalnizSunucuOlayi, SABLON_UYMUYOR_HATA } from "../src/bolumler/10-iletisim/kurallar";
import { ayrilanAcikBorclar, veliGonderimGorunur } from "../src/bolumler/11-veli-portali/kurallar";
import { avansEngeli, donmusOlustur, etutUcretiEngeli, farkAktar, hakEdisHesabi, hakedisAnahtari, hakedisDurumEngeli, hakedisDuzeltmeEngeli, hakedisIslemiMi, hakedisimOzeti, hakedisKaydi, MAAS_KATEGORISI, MASKELI_MAAS_ACIKLAMASI, maskeliAlanlariKoru, odemeAciklamasi, personelMaskele, personelSilmeEngeli, personelTemizle, personelYazmaEngeli, type Avans, type Goren, type HakedisKaydi } from "../src/bolumler/13-personel/kurallar";
import { farkUygula } from "../src/data/fark";
import type { Gider, Gonderim, Iade, Musaitlik, Odev, Paket, Randevu, Tahsilat, Taksit, Virman, Yoklama } from "../src/data/model";

const ayni = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
import { tarihEkle, telefonNormalize } from "../src/lib/kurallar";
import { KOLEKSIYONLAR, TEKILLER, anahtar, type Degisiklik, type Koleksiyon, type Satir, type Tekil } from "./veritabani";

export class YetkiHatasi extends Error {}

export type Aktor = { kullanici: Kullanici; personel: Personel };

const dizi = (db: Db, k: Koleksiyon) => {
  const v = (db as unknown as Record<string, unknown>)[k];
  return (Array.isArray(v) ? v : Object.values((v as object) ?? {})) as Satir[];
};

export function kapsam(db: Db, k: Kullanici): string[] {
  const aktif = db.subeler.filter((s) => s.aktif).map((s) => s.id);
  if (k.subeIds === "all") return db.subeler.map((s) => s.id);
  return k.subeIds.filter((s) => aktif.includes(s) || db.subeler.some((x) => x.id === s));
}

/** Karar 2026-11-08: grubu devreden öğretmenin erişimi kesilir (kapanmış satır grup vermez) */
export function ogretmenGruplari(db: Db, personelId: string, bugun: string = BUGUN): Set<string> {
  return ogretmenGruplariHesapla(db, personelId, bugun);
}

const yetki = (db: Db, a: Aktor, kod: string) => bolumYetkisi(db.rolYetkileri, a.kullanici.rol, kod);
const grupSube = (db: Db, grupId: unknown) => db.gruplar.find((g) => g.id === grupId)?.subeId ?? null;
const ogrenciSube = (db: Db, ogrenciId: unknown) =>
  aktifKayit(db, String(ogrenciId))?.subeId ?? db.kayitlar.find((k) => k.ogrenciId === ogrenciId)?.subeId ?? null;

/** Satırın bağlı olduğu şube(ler). null = kurum geneli (şubeye bağlı değil) */
export function satirSubeleri(db: Db, k: Koleksiyon, s: Satir): string[] | null {
  const tek = (x: unknown) => (x && x !== "merkez" ? [String(x)] : null);
  switch (k) {
    case "subeler":
      return [String(s.id)];
    case "derslikler": case "dersSaatleri": case "gruplar": case "kayitlar": case "taksitler": case "tahsilatlar":
    case "musaitlikler": case "randevular": case "adaylar": case "gonderimler": case "avanslar": case "tatiller": case "giderler": case "iadeler": case "islemler":
      return tek(s.subeId);
    case "program": case "yoklamalar": case "odevler":
      return tek(grupSube(db, s.grupId));
    case "iptaller": case "yedekAtamalari": {
      const p = db.program.find((x) => String(s.oturumId).startsWith(x.id + "_"));
      return tek(p && grupSube(db, p.grupId));
    }
    case "izinler": case "paketler":
      return tek(ogrenciSube(db, s.ogrenciId));
    case "ogrenciler":
      // Kaydı olmayan öğrenci hiçbir şubeye ait değildir: kurum geneli sayılmaz, yalnızca genel yönetici görür (Bölüm 04)
      return tek(ogrenciSube(db, s.id)) ?? [];
    case "veliler": {
      const l = db.ogrenciler.filter((o) => o.veliIds.includes(String(s.id))).map((o) => ogrenciSube(db, o.id)).filter(Boolean) as string[];
      return l.length ? [...new Set(l)] : [];
    }
    case "personel":
      return (s.subeIds as string[]) ?? [];
    case "kullanicilar":
      return s.subeIds === "all" ? null : ((s.subeIds as string[]) ?? []);
    case "duyurular": {
      const h = s.hedef as { tur: string; deger: string | null };
      if (h?.tur === "sube") return tek(h.deger);
      if (h?.tur === "grup") return tek(grupSube(db, h.deger));
      // Şube personelinin seviye duyurusu kendi şubeleriyle sınırlıdır (Bölüm 10)
      if (h?.tur === "seviye" && Array.isArray(s.subeIds) && s.subeIds.length) return s.subeIds as string[];
      return null;
    }
    case "virmanlar":
      return [String(s.kaynak).split(":")[0], String(s.hedef).split(":")[0]].filter((x) => x !== "merkez");
    default:
      return null; // sezonlar, dersler, olaylar, girisler, iceAktarmalar, kvkk
  }
}

/** Tabloya yazılacak tek şube sütunu */
export function subeSutunu(db: Db, k: Koleksiyon, s: Satir): string | null {
  const l = satirSubeleri(db, k, s);
  return l && l.length ? l[0] : null;
}

/* =========================== Okuma =========================== */
const FINANS: Koleksiyon[] = ["taksitler", "tahsilatlar", "giderler", "virmanlar", "iadeler"];
/** Kaydın finans (ücret) alanları: finans görmeyene maskelenir, onun yazmasında eski değer korunur */
const KAYIT_FINANS_ALANLARI = ["listeFiyati", "indirimler", "net", "bekleyenIndirim", "indirimOnay", "iptalHesabi"] as const;

/**
 * Finans verisini kim görür (Bölüm 05): modül açık, 05 yetkisi var ve öğretmen değil.
 * Görmeyen personele taksit, tahsilat, gider, virman gitmez; kayıtların ücret alanları (liste fiyatı, indirim, net) sıfırlanır.
 */
export function finansGorur(db: Db, a: Aktor): boolean {
  return db.moduller?.finans === true && a.kullanici.rol !== "ogretmen" && yetki(db, a, "05");
}

export function okumaSuz(db: Db, a: Aktor, bugun: string = BUGUN): Db {
  const genel = a.kullanici.rol === "genel-yonetici";
  const ogretmen = a.kullanici.rol === "ogretmen";
  const kap = new Set(kapsam(db, a.kullanici));
  const ogrGrup = ogretmen ? ogretmenGruplari(db, a.personel.id, bugun) : null;
  const finans = finansGorur(db, a);
  const yetki13 = yetki(db, a, "13");
  const goren: Goren = { rol: a.kullanici.rol, personelId: a.personel.id, yetki13 };
  // Yedek öğretmen: yalnızca görevli olduğu oturum için gereken satırlar (kalıcı grup erişimi yok, karar 2026-11-09)
  const yedek = ogretmen ? yedekErisimi(db, a.personel.id, bugun, GEC_YOKLAMA_GUN) : null;
  const sonuc = { ...db } as unknown as Record<string, unknown>;

  const gorur = (k: Koleksiyon, s: Satir): boolean => {
    if (FINANS.includes(k) && !finans) return false;
    if (k === "girisler") return genel;
    // Avans ve hak ediş işlem kaydı ücret verisidir (Bölüm 13): 13 yetkisi yoksa yalnızca kendi avansı
    if (k === "avanslar" && !genel && !yetki13) return s.personelId === a.personel.id;
    if (k === "islemler" && !genel && !yetki13 && hakedisIslemiMi(String(s.islem))) return false;
    if ((k === "kvkk" || k === "iceAktarmalar") && !yetki(db, a, "14")) return false;
    if (k === "kullanicilar" && !yetki(db, a, "02")) return s.id === a.kullanici.id;
    // Aday kişisel verisi (KVKK): yalnızca ön kayıt (03) veya kesin kayıt (04) yetkisi olan görür
    if (k === "adaylar" && !genel && !yetki(db, a, "03") && !yetki(db, a, "04")) return false;
    // Şube tanımları kişisel veri içermez; nakil / devir hedefi seçilebilsin diye her personel görür (kapsam değişmez)
    if (k === "subeler") return true;
    // İşlem kaydı detayındaki tutar da finans verisidir (Bölüm 12)
    if (k === "islemler" && !finans && finansIslemiMi(String(s.islem))) return false;
    if (k === "islemler" && !s.subeId) return genel;
    if (k === "giderler" && s.subeId === "merkez") return genel;
    const l = satirSubeleri(db, k, s);
    if (l === null) return true;
    if (genel) return true;
    if (k === "veliler" && l.length === 0) return true; // henüz çocuğa bağlanmamış (yeni) veli
    return l.some((x) => kap.has(x));
  };

  for (const k of KOLEKSIYONLAR) {
    let l = dizi(db, k).filter((s) => gorur(k, s));
    if (ogrGrup) {
      // Öğretmen yalnızca kendi gruplarını görür; finans ve aday verisi yok
      const ogrIds = new Set(db.kayitlar.filter((x) => ogrGrup.has(x.grupId)).map((x) => x.ogrenciId));
      const listeOturumlari = [...yedek!.oturumlar].map((o) => ({ tarih: o.slice(o.lastIndexOf("_") + 1), grupId: db.program.find((p) => p.id === o.slice(0, o.lastIndexOf("_")))!.grupId }));
      const yedekOgr = new Set(db.kayitlar.filter((x) => !ogrIds.has(x.ogrenciId) && x.durum === "aktif" && listeOturumlari.some((o) => kayitGrubu(x, o.tarih) === o.grupId)).map((x) => x.ogrenciId));
      if (k === "yedekAtamalari") l = l.filter((s) => s.ogretmenId === a.personel.id || db.program.some((p) => ogrGrup.has(p.grupId) && String(s.oturumId).startsWith(p.id + "_")));
      if (k === "gruplar") l = l.filter((s) => ogrGrup.has(String(s.id)) || yedek!.gruplar.has(String(s.id)));
      if (k === "kayitlar") l = l.filter((s) => ogrGrup.has(String(s.grupId)) || yedekOgr.has(String(s.ogrenciId)));
      // Kendi etüt randevusundaki başka grubun öğrencisi: yalnızca adı görünür (Bölüm 09)
      const etutOgr = k === "ogrenciler" ? new Set(db.randevular.filter((r) => r.ogretmenId === a.personel.id && r.durum !== "iptal").flatMap((r) => r.ogrenciIds)) : null;
      if (etutOgr)
        l = l
          .filter((s) => ogrIds.has(String(s.id)) || etutOgr.has(String(s.id)) || yedekOgr.has(String(s.id)))
          .map((s) => {
            if (ogrIds.has(String(s.id))) return s;
            const gizli = { ...s, dogum: "", okul: "", okulSinifi: "", saglikNotu: "", notlar: [] };
            // Yedeğin ekranı devamsızlık bildirimini veliye bağlar; kimlik dışında bilgi gitmez
            return yedekOgr.has(String(s.id)) ? gizli : { ...gizli, veliIds: [], birincilVeliId: "" };
          });
      // Öğretmen yalnızca kendi etüt kayıtlarını görür; paket ücreti finans verisidir (Bölüm 09)
      if (k === "randevular" || k === "musaitlikler" || k === "paketler") l = l.filter((s) => s.ogretmenId === a.personel.id);
      // Devredilen grubun yoklama ve ödevi (öğrenci kimlikli veri) gitmez; öğretmenin kendi eski program satırı kalır (öğrenci verisi yok)
      if (k === "yoklamalar") l = l.filter((s) => ogrGrup.has(String(s.grupId)) || yedek!.oturumlar.has(String(s.oturumId)));
      if (k === "odevler") l = l.filter((s) => ogrGrup.has(String(s.grupId)));
      if (k === "program") l = l.filter((s) => ogrGrup.has(String(s.grupId)) || s.ogretmenId === a.personel.id || yedek!.satirlar.has(String(s.id)));
      if (k === "iptaller") l = l.filter((s) => db.program.some((p) => ogrGrup.has(p.grupId) && String(s.oturumId).startsWith(p.id + "_")));
      // Veli izni (sağlık notu içerebilir) yalnızca kendi gruplarının öğrencileri için
      if (k === "izinler") l = l.filter((s) => ogrIds.has(String(s.ogrenciId)) || yedekOgr.has(String(s.ogrenciId))).map((s) => (ogrIds.has(String(s.ogrenciId)) ? s : { ...s, not: "" }));
      if (k === "veliler")
        l = l
          .filter((s) => db.ogrenciler.some((o) => (ogrIds.has(o.id) || yedekOgr.has(o.id)) && o.veliIds.includes(String(s.id))))
          .map((s) => ({ ...s, telefon: maskele(String(s.telefon)), eposta: "" }));
      if (k === "adaylar" || k === "duyurular" || k === "gonderimler" || k === "islemler" || k === "kvkk") l = [];
    }
    if (k === "personel") l = l.map((s) => personelMaskele(s as unknown as Personel, goren) as unknown as Satir);
    // Finans görenin kasası tam kalsın diye tutar gider; kimin maaşı olduğu yalnızca 13 yetkisiyle (Bölüm 13)
    if (k === "giderler" && !genel && !yetki13) l = l.map((s) => (s.kategori === MAAS_KATEGORISI ? { ...s, aciklama: MASKELI_MAAS_ACIKLAMASI } : s));
    if (k === "paketler" && !finans) l = l.map((s) => ({ ...s, fiyat: 0 }));
    // Kayıt ücreti finans verisidir; yazarken sunucu maskeli alanları eski değerle korur (yazmaDenetle)
    if (k === "kayitlar" && !finans)
      l = l.map((s) => {
        const { bekleyenIndirim: _b, indirimOnay: _o, iptalHesabi: _i, ...temel } = s;
        void _b; void _o; void _i;
        return { ...temel, listeFiyati: 0, indirimler: [], net: 0 };
      });
    sonuc[k] = k === "yoklamalar" ? Object.fromEntries(l.map((s) => [s.oturumId, s])) : l;
  }
  // Karar 2026-11-08: şube müdürü öğretmenin diğer şubelerdeki derslerini yalnızca dolu saat olarak görür (ayrı alan: koleksiyon değil, geri yazılamaz)
  if (a.kullanici.rol === "sube-muduru") sonuc.doluSaatler = doluSaatleriHesapla(db, kap);
  // Personel ücret bilgisi yalnızca hak ediş yetkisi olanlara
  if (!yetki13 && !genel) sonuc.hakedisDurum = {};
  else if (!genel) sonuc.hakedisDurum = Object.fromEntries(Object.entries(db.hakedisDurum ?? {}).filter(([ak]) => db.personel.some((p) => p.id === hakedisAnahtari(ak)?.personelId && p.subeIds.some((x) => kap.has(x)))));
  // Öğretmenin kendi dökümü sunucuda hesaplanır: etüt ücreti, gider ve başkasının kaydı gitmez (karar 2026-11-09)
  if (ogretmen && db.moduller?.hakedis === true) sonuc.hakedisim = hakedisimOzeti(db, a.personel, bugun, db.moduller?.finans === true);
  if (!yetki13 && !genel && db.kurum) {
    const { etutDersUcreti: _e, ...kurum } = db.kurum;
    void _e;
    sonuc.kurum = kurum;
  }
  return sonuc as unknown as Db;
}

export const maskele = (tel: string) => (tel.length > 4 ? tel.slice(0, 2) + tel.slice(2, -2).replace(/\d/g, "*") + tel.slice(-2) : "***");

/* =========================== Yazma =========================== */
/** Koleksiyon → yazma yetkisi veren bölüm kodları ("*" = her personel) */
const YAZMA: Record<Koleksiyon, string[]> = {
  subeler: ["01"], sezonlar: ["01"], dersler: ["01"], derslikler: ["01"], dersSaatleri: ["01"], gruplar: ["01"],
  personel: ["13", "02"], kullanicilar: ["02", "13"], girisler: [],
  veliler: ["04", "14", "02"], ogrenciler: ["04", "14"], kayitlar: ["04", "14"],
  program: ["06"], tatiller: ["06"], iptaller: ["06"], yedekAtamalari: ["06"], yoklamalar: ["07"], izinler: ["07"],
  adaylar: ["03", "04", "14"], odevler: ["08"], musaitlikler: ["09"], randevular: ["09"], paketler: ["09", "04"],
  olaylar: ["10"], gonderimler: ["*"], duyurular: ["10"],
  taksitler: ["05", "04", "09"], tahsilatlar: ["05"], giderler: ["05", "13"], virmanlar: ["05"], iadeler: ["05"],
  islemler: ["*"], iceAktarmalar: ["14"], kvkk: ["14"], avanslar: ["13"],
};
const TEKIL_YAZMA: Record<Tekil, string[]> = {
  kurum: ["01"], moduller: ["01"], fiyatListesi: ["01"], rolYetkileri: ["02"], ayarlar: ["10", "14"], hakedisDurum: ["13"], otomasyon: [],
};
/** Silinebilen koleksiyonlar (diğerleri yalnızca pasife alınır / iptal edilir) */
const SILINEBILIR = new Set<Koleksiyon>(["musaitlikler", "odevler", "tatiller", "program", "iptaller", "yedekAtamalari", "derslikler", "dersSaatleri"]);
/** Yalnızca genel yöneticinin değiştirebildiği kurum geneli tanımlar */
const GENEL_TANIM = new Set<Koleksiyon>(["subeler", "sezonlar", "dersler", "olaylar"]);

const gecerliId = (id: string) => /^[A-Za-z0-9_\-:.]{1,80}$/.test(id);

/**
 * Değişikliği denetler ve sunucunun koyduğu alanlarla (kullanıcı adı, zaman, gönderim durumu) temizlenmiş halini döndürür.
 * sonrakiDb: değişiklik uygulanmış hali (yeni öğrenci + kaydı aynı pakette gelebilir)
 */
export function yazmaDenetle(onceki: Db, sonrakiDb: Db, d: Degisiklik, a: Aktor, zaman: string): Degisiklik {
  const rol = a.kullanici.rol;
  const genel = rol === "genel-yonetici";
  const kap = new Set(kapsam(onceki, a.kullanici));
  const ad = `${a.personel.ad} ${a.personel.soyad}`;
  const ogrGrup = rol === "ogretmen" ? ogretmenGruplari(onceki, a.personel.id, zaman.slice(0, 10)) : null;
  const hata = (m: string): never => {
    throw new YetkiHatasi(m);
  };

  const kapsamda = (l: string[] | null, k: Koleksiyon) => {
    if (genel) return true;
    if (l === null) return false; // kurum geneli kayıt: yalnızca genel yönetici
    if (k === "veliler" && l.length === 0) return true;
    return l.length > 0 && l.every((x) => kap.has(x));
  };

  const temiz: Degisiklik = { koleksiyonlar: {}, tekil: {} };

  for (const [t, v] of Object.entries(d.tekil ?? {}) as [Tekil, unknown][]) {
    if (!TEKILLER.includes(t)) hata(`Bilinmeyen ayar: ${t}`);
    if (!TEKIL_YAZMA[t].some((b) => yetki(onceki, a, b))) hata("Bu ayarı değiştirme yetkiniz yok.");
    if (t !== "hakedisDurum" && !genel) hata("Kurum geneli ayarları yalnızca genel yönetici değiştirebilir.");
    temiz.tekil[t] = v;
  }

  for (const [k, v] of Object.entries(d.koleksiyonlar ?? {}) as [Koleksiyon, { yaz: Satir[]; sil: string[] }][]) {
    if (!KOLEKSIYONLAR.includes(k)) hata(`Bilinmeyen veri: ${k}`);
    const izin = YAZMA[k];
    if (!izin.includes("*") && !izin.some((b) => yetki(onceki, a, b))) hata(`“${k}” verisini değiştirme yetkiniz yok.`);
    if (GENEL_TANIM.has(k) && !genel) hata("Kurum geneli tanımları yalnızca genel yönetici değiştirebilir.");
    // Öğretmen finans verisine hiçbir yoldan yazamaz (Bölüm 02); paket satışı engeli: etutDenetle
    if (rol === "ogretmen" && FINANS.includes(k)) hata("Öğretmen finans kayıtlarını değiştiremez.");
    const eskiler = new Map(dizi(onceki, k).map((s) => [anahtar(k, s), s]));
    const yaz: Satir[] = [];

    for (const ham of v.yaz ?? []) {
      const s = { ...ham };
      const id = anahtar(k, s);
      if (!gecerliId(id)) hata("Geçersiz kayıt kimliği.");
      const eski = eskiler.get(id);
      // Eski ve yeni hali kapsamda olmalı (başka şubeye taşıma / başka şubenin kaydını ezme engeli)
      if (eski && !kapsamda(satirSubeleri(onceki, k, eski), k)) hata("Bu kayıt şube kapsamınız dışında.");
      // Tek istisna (karar 2026-11-07): kapsamdaki adayın kapsam dışındaki şubeye devri; ayrıntı onKayitDenetle · adayDevirEngeli
      const adayDevri = k === "adaylar" && !!eski && eski.subeId !== s.subeId && !!s.subeId;
      // İkinci istisna (karar 2026-11-07): kapsamdaki kaydın kapsam dışındaki aktif şubeye nakli; ayrıntı kayitDenetle · kapsamDisiNakilEngeli
      const kayitNakli = k === "kayitlar" && !!eski && eski.subeId !== s.subeId && !!s.subeId;
      if (!adayDevri && !kayitNakli && !kapsamda(satirSubeleri(sonrakiDb, k, s), k)) hata("Kayıt şube kapsamınız dışında.");

      switch (k) {
        case "islemler":
          if (eski) hata("İşlem kaydı değiştirilemez.");
          s.kullanici = s.kullanici === "Sistem" ? "Sistem" : ad;
          s.zaman = zaman;
          break;
        case "girisler":
          hata("Giriş kaydı yazılamaz.");
          break;
        case "gonderimler":
          if (eski) {
            // Yalnızca başarısız gönderimi yeniden kuyruğa alma
            if (s.durum === "basarisiz") hata("Gönderim kaydı değiştirilemez.");
            {
              const engel = tekrarEngeli(eski as unknown as Gonderim, yetki(onceki, a, "10"));
              if (engel) hata(engel);
            }
            yaz.push({ ...eski, durum: "bekliyor", hata: undefined, gonderimBasladi: undefined, deneme: Number(eski.deneme ?? 0) + 1, zaman });
            continue;
          }
          s.durum = "bekliyor";
          s.zaman = zaman;
          break;
        case "giderler": case "virmanlar": case "iadeler":
          // İptal eden ve zamanı sunucudan (karar 2026-11-08); ayrıntı finansDenetle()
          if (eski && s.iptal && typeof s.iptal === "object") s.iptal = { ...(s.iptal as object), kullanici: ad, zaman };
          break;
        case "tahsilatlar":
          // Ayrıntılı kurallar: finansDenetle() (Bölüm 05). Tahsil eden, tahsilat ve iptal zamanı sunucudan.
          if (eski) {
            if (s.iptal && typeof s.iptal === "object") s.iptal = { ...(s.iptal as object), kullanici: ad, zaman };
          } else {
            s.kullanici = ad;
            s.zaman = zaman;
          }
          break;
        case "kullanicilar":
          // Ayrıntılı kurallar: kullaniciDenetle() (Bölüm 02). Son giriş zamanını yalnızca sunucu yazar.
          s.eposta = epostaNormalize(s.eposta);
          s.sonGiris = eski ? (eski.sonGiris ?? null) : null;
          break;
        case "yoklamalar":
          if (ogrGrup) {
            if (!ogrGrup.has(String(s.grupId)) && oturumYedegi(onceki, String(s.oturumId))?.ogretmenId !== a.personel.id) hata("Yalnızca kendi gruplarınızın yoklamasını alabilirsiniz.");
          }
          // Ayrıntılı kurallar: yoklamaDenetle() (Bölüm 07)
          break;
        case "adaylar":
          // Ayrıntılı kurallar: onKayitDenetle() (Bölüm 03). Telefon tek biçime çevrilir; oluşturma tarihi ve not yazarı sunucudan.
          if (!anonimMi(s as unknown as Aday)) {
            s.veliTelefon = telefonNormalize(String(s.veliTelefon ?? "")) ?? s.veliTelefon;
            if (typeof s.veliAd === "string") s.veliAd = adTemizle(s.veliAd);
            if (typeof s.ogrenciAd === "string") s.ogrenciAd = adTemizle(s.ogrenciAd) || "—";
          }
          s.olusturma = eski ? eski.olusturma : zaman.slice(0, 10);
          // Kapsam dışına devir: sorumlu hedef şubeden sunucuda atanır (ekran o şubenin personelini göremeyebilir)
          if (eski && eski.subeId !== s.subeId && !genel && !kap.has(String(s.subeId)))
            s.sorumluId = varsayilanSorumlu(sonrakiDb.personel, String(s.subeId)) ?? s.sorumluId;
          if (eski && Array.isArray(s.notlar) && Array.isArray(eski.notlar))
            s.notlar = (s.notlar as Aday["notlar"]).map((n, i) => (i < (eski.notlar as unknown[]).length ? n : { ...n, yazar: ad, tarih: zaman }));
          break;
        case "kayitlar":
          // Ücret alanları finans görmeyene maskeli gider (okumaSuz); onun yazdığı kayıtta eski değerler korunur
          if (eski && !finansGorur(onceki, a))
            for (const alan of KAYIT_FINANS_ALANLARI) {
              if (alan in eski) s[alan] = eski[alan];
              else delete s[alan];
            }
          // Finans kapalıyken yeni kayıt ücretsizdir (ekran başka bir kayıttan kopyalasa da ücret yazılmaz)
          if (!eski && onceki.moduller?.finans !== true) {
            s.listeFiyati = 0;
            s.indirimler = [];
            s.net = 0;
            delete s.bekleyenIndirim;
            delete s.iptalHesabi;
          }
          // Kapsam dışına nakil: ekran hedef şubenin gruplarını göremez; grubu sunucu atar (aynı seviye, boş kontenjan)
          if (eski && eski.subeId !== s.subeId && !genel && !kap.has(String(s.subeId))) {
            const g = nakilHedefGrubu(sonrakiDb, eski as unknown as Kayit, String(s.subeId));
            if (g) {
              s.grupId = g.id;
              s.grupGecmisi = [...((eski.grupGecmisi as Kayit["grupGecmisi"]) ?? []), { grupId: g.id, tarih: zaman.slice(0, 10) }];
            }
          }
          break;
        case "veliler":
          // Ayrıntılı kurallar: kayitDenetle() (Bölüm 04). Telefon tek biçime çevrilir (veli portalı girişi telefonla eşleşir).
          if (!veliAnonimMi(s as unknown as Veli)) {
            s.telefon = telefonNormalize(String(s.telefon ?? "")) ?? s.telefon;
            if (typeof s.ad === "string") s.ad = adTemizle(s.ad);
            if (typeof s.soyad === "string") s.soyad = adTemizle(s.soyad);
            if (typeof s.eposta === "string") s.eposta = s.eposta.trim();
          }
          break;
        case "ogrenciler":
          // Ayrıntılı kurallar: kayitDenetle() (Bölüm 04). Yeni notlar başa eklenir; yazarı ve zamanı sunucudan.
          if (!ogrenciAnonimMi(s as unknown as Ogrenci)) {
            if (typeof s.ad === "string") s.ad = adTemizle(s.ad);
            if (typeof s.soyad === "string") s.soyad = adTemizle(s.soyad);
          }
          if (Array.isArray(s.notlar)) {
            const yeni = s.notlar.length - (Array.isArray(eski?.notlar) ? (eski.notlar as unknown[]).length : 0);
            s.notlar = (s.notlar as Ogrenci["notlar"]).map((n, i) => (i < yeni && n && typeof n === "object" ? { ...n, yazar: ad, tarih: zaman } : n));
          }
          break;
        // Ödevin ayrıntılı kuralları: odevDenetle() (Bölüm 08)
        // Etüdün ayrıntılı kuralları: etutDenetle() (Bölüm 09)
        case "musaitlikler": case "randevular":
          if (ogrGrup && s.ogretmenId !== a.personel.id) hata("Yalnızca kendi kayıtlarınızı değiştirebilirsiniz.");
          break;
      }
      yaz.push(s);
    }

    const sil: string[] = [];
    for (const id of v.sil ?? []) {
      const eski = eskiler.get(id);
      if (!eski) continue;
      if (!kapsamda(satirSubeleri(onceki, k, eski), k)) hata("Bu kayıt şube kapsamınız dışında.");
      const iceAktarmaGeriAl =
        ((k === "ogrenciler" || k === "kayitlar") && !!eski.iceAktarmaId) ||
        (k === "personel" && !!eski.iceAktarmaId && !onceki.program.some((p) => p.ogretmenId === id)) ||
        (k === "kullanicilar" && !!onceki.personel.find((p) => p.id === eski.personelId)?.iceAktarmaId);
      const iceAktarmaVelisi = k === "veliler" && !sonrakiDb.ogrenciler.some((o) => o.veliIds.includes(id));
      if (!SILINEBILIR.has(k) && !iceAktarmaGeriAl && !iceAktarmaVelisi) hata(`“${k}” kaydı silinemez; pasife alın veya iptal edin.`);
      if (ogrGrup && eski.ogretmenId !== a.personel.id) hata("Yalnızca kendi kayıtlarınızı silebilirsiniz.");
      sil.push(id);
    }
    temiz.koleksiyonlar[k] = { yaz, sil };
  }
  tanimDenetle(onceki, sonrakiDb, temiz);
  iletisimDenetle(onceki, sonrakiDb, temiz, a, zaman); // önce: yoklama, ödev, etüt denetimleri temizlenmiş satırları görür
  programDenetle(onceki, sonrakiDb, temiz, a, zaman);
  yoklamaDenetle(onceki, sonrakiDb, temiz, a, zaman);
  odevDenetle(onceki, sonrakiDb, temiz, a, zaman);
  etutDenetle(onceki, sonrakiDb, temiz, a, zaman);
  personelDenetle(onceki, sonrakiDb, temiz, a, zaman); // önce: pasife alma zinciri temizlenmiş kartı görür
  kullaniciDenetle(onceki, sonrakiDb, temiz, a);
  kayitDenetle(onceki, sonrakiDb, temiz, a, zaman);
  finansDenetle(onceki, temiz, a, zaman);
  onKayitDenetle(onceki, sonrakiDb, temiz, a);
  etutKayitIptali(onceki, temiz);
  return temiz;
}

/* =========================== Bölüm 06 ders programı =========================== */
/**
 * Program, tatil ve iptal kuralları (ekranla ortak: src/bolumler/06-ders-programi/kurallar.ts):
 * - öğretmen 06'yı görür ama programı, tatili, iptali değiştiremez
 * - çakışma tüm şubelerde aranır: ekran kapsam dışındaki şubenin programını göremez
 * - başlamış satır yalnızca kapatılır; değişiklik yeni satırla, yoklama / iptal kayıtlarından sonra başlar
 * Şube kapsamı yazmaDenetle() içinde denetlenir. İptal tarihi sunucudan yazılır (`temiz` yerinde güncellenir).
 */
export function programDenetle(onceki: Db, sonraki: Db, temiz: Degisiklik, a: Aktor, zaman: string): void {
  const reddet = (m: Hata) => {
    if (m) throw new YetkiHatasi(m);
  };
  const K = temiz.koleksiyonlar;
  const programYaz = (K.program?.yaz ?? []) as unknown as ProgramSatiri[];
  const tatilYaz = (K.tatiller?.yaz ?? []) as unknown as Tatil[];
  const iptalYaz = (K.iptaller?.yaz ?? []) as unknown as Iptal[];
  const programSil = K.program?.sil ?? [];
  const tatilSil = K.tatiller?.sil ?? [];
  const iptalSil = K.iptaller?.sil ?? [];
  // Oturum bazlı yedek (karar 2026-11-09): atayan ve zaman sunucudan; veliye bildirim yok
  for (const id of K.yedekAtamalari?.sil ?? []) reddet(yedekKaldirmaEngeli(id, onceki, zaman.slice(0, 10), a.kullanici.rol));
  for (const y of (K.yedekAtamalari?.yaz ?? []) as unknown as YedekAtama[]) {
    reddet(yedekAtamaEngeli(y, sonraki, zaman.slice(0, 10), a.kullanici.rol));
    y.atayan = `${a.personel.ad} ${a.personel.soyad}`;
    y.zaman = zaman;
  }
  if (!programYaz.length && !tatilYaz.length && !iptalYaz.length && !programSil.length && !tatilSil.length && !iptalSil.length) return;
  if (a.kullanici.rol === "ogretmen") reddet("Ders programını yalnızca yönetim değiştirebilir.");
  const bugun = zaman.slice(0, 10);
  for (const id of programSil) {
    const eski = onceki.program.find((x) => x.id === id);
    if (eski) reddet(programSilmeEngeli(eski, onceki, bugun));
  }
  const secenek = { bransDisi: bransDisiAtayabilir(a.kullanici.rol) };
  for (const s of programYaz) reddet(programYazmaEngeli(s, onceki.program.find((x) => x.id === s.id), sonraki, bugun, secenek));
  for (const id of tatilSil) {
    const eski = onceki.tatiller.find((x) => x.id === id);
    if (eski) reddet(tatilSilmeEngeli(eski, bugun));
  }
  for (const t of tatilYaz) reddet(tatilYazmaEngeli(t, onceki.tatiller.find((x) => x.id === t.id), sonraki, bugun));
  // Silme yalnızca iptalin geri alınmasıdır (karar 2026-11-08)
  for (const id of iptalSil) {
    const eski = onceki.iptaller.find((x) => x.oturumId === id);
    if (eski) reddet(iptalGeriAlmaEngeli(eski, onceki, bugun));
  }
  for (const i of iptalYaz) {
    reddet(iptalYazmaEngeli(i, onceki.iptaller.find((x) => x.oturumId === i.oturumId), sonraki, bugun));
    i.tarih = bugun;
  }
}

/* =========================== Bölüm 10 iletişim =========================== */
/**
 * Olay ayarı, duyuru ve personelin yazdığı gönderim satırı (ekranla ortak: src/bolumler/10-iletisim/kurallar.ts):
 * - şablon yalnızca olayın değişkenlerini kullanır; olay tanımı (ad, finans, modül) değişmez; gönderim aralığı, birim fiyat geçerli
 * - duyuru: hedef gerçek; gönderilmiş duyuru değişmez; alıcı, gönderen, okundu, gönderim satırları sunucudan
 * - satırı yalnızca olayı üretebilen rol yazar; alıcı öğrencinin velisi ve şubesi kapsamda; adaya yalnızca bu paketteki, rızalı adayın numarasına
 * - metin olayın şablonuna uymalı, uymayan satır reddedilir (karar 2026-11-09); alıcı, şube, kanal, maliyet sunucudan; SMS izni olmayan veliye SMS yok
 * Şube kapsamının genel kuralı yazmaDenetle() içinde. Sunucunun sonradan ürettiği satırlar (düzeltme, iptal) bu denetimden geçmez. `temiz` yerinde güncellenir.
 */
export function iletisimDenetle(onceki: Db, sonraki: Db, temiz: Degisiklik, a: Aktor, zaman: string): void {
  const reddet = (m: Hata) => {
    if (m) throw new YetkiHatasi(m);
  };
  const K = temiz.koleksiyonlar;
  const rol = a.kullanici.rol;
  const genel = rol === "genel-yonetici";
  const kap = new Set(kapsam(onceki, a.kullanici));
  const tekil = temiz.tekil ?? {};

  for (const o of (K.olaylar?.yaz ?? []) as unknown as BildirimOlayi[]) reddet(olayYazmaEngeli(o, onceki.olaylar.find((x) => x.key === o.key)));
  if ("ayarlar" in tekil) reddet(ayarEngeli(tekil.ayarlar as Db["ayarlar"], onceki.ayarlar));

  // Duyurular: gönderilenlerin satırları sunucuda üretilir (kişi başı bir satır, doğru şube, SMS izni)
  const gidenDuyurular: Duyuru[] = [];
  if (K.duyurular) {
    K.duyurular.yaz = (K.duyurular.yaz as unknown as Duyuru[]).map((du) => {
      const eski = onceki.duyurular.find((x) => x.id === du.id);
      if (eski && !eski.zamanlanmis) reddet("Gönderilmiş duyuru değiştirilemez.");
      if (eski && du.zamanlanmis) reddet("Zamanlanmış duyuru yalnızca gönderilebilir.");
      const taban: Duyuru = eski
        ? { ...eski, zamanlanmis: false, zaman }
        : { ...du, baslik: String(du.baslik ?? "").trim(), metin: String(du.metin ?? "").trim(), gonderen: `${a.personel.ad} ${a.personel.soyad}`, okuyanVeliIds: [], zaman: du.zamanlanmis ? du.zaman : zaman };
      reddet(duyuruEngeli(taban, sonraki, zaman));
      const subeIds = eski ? (eski.subeIds ?? null) : taban.hedef.tur === "seviye" && !genel ? (du.subeIds ?? []).filter((s) => kap.has(s)) : null;
      const yeni: Duyuru = { ...taban, subeIds, aliciVeliIds: hedefVeliler(sonraki, taban.hedef, subeIds) };
      if (!yeni.zamanlanmis) gidenDuyurular.push(yeni);
      return yeni;
    }) as unknown as Satir[];
  }

  if (K.gonderimler) {
    const moduller = onceki.moduller as unknown as Record<string, boolean | undefined>;
    K.gonderimler.yaz = (K.gonderimler.yaz as unknown as Gonderim[]).filter((g) => {
      if (onceki.gonderimler.some((x) => x.id === g.id)) return true; // yeniden kuyruğa alma: yazmaDenetle
      if (yalnizSunucuOlayi(g.olay)) return false;
      const tanim = onceki.olaylar.find((o) => o.key === g.olay);
      if (!tanim) throw new YetkiHatasi("Bilinmeyen bildirim türü.");
      if (!olayUretmeYetkisi(g.olay, rol, (b) => yetki(onceki, a, b))) reddet("Bu bildirimi oluşturma yetkiniz yok.");
      if (!olayCalisir(tanim, moduller)) return false;
      reddet(metinEngeli(g.metin));
      delete g.hata;
      delete g.deneme;
      delete g.gonderimBasladi;
      delete g.adayId;
      if (!metinSablonaUyar(g.metin, tanim.sablon)) reddet(SABLON_UYMUYOR_HATA);

      if (g.veliId === null || g.veliId === undefined) {
        // Velisiz satır yalnızca bu pakette eklenen adayın teşekkür mesajıdır; numara adaydan, rıza şart (Bölüm 03 devri)
        if (g.olay !== "onKayitTesekkur") reddet("Alıcısız bildirim yazılamaz.");
        const tel = telefonNormalize(String(g.alici ?? "").split("·").pop() ?? "");
        const aday = ((K.adaylar?.yaz ?? []) as unknown as Aday[]).find((x) => !onceki.adaylar.some((y) => y.id === x.id) && !!tel && telefonNormalize(x.veliTelefon) === tel);
        if (!aday) throw new YetkiHatasi("Bildirim bu işlemdeki bir adaya ait olmalı.");
        if (!aday.rizaVar) return false;
        Object.assign(g, { veliId: null, adayId: aday.id, ogrenciId: null, subeId: aday.subeId, alici: `${aday.veliAd} · ${tel}`, kanal: "sms", maliyet: smsBoyuMaliyet(onceki, g.metin) });
        return true;
      }

      const veli = sonraki.veliler.find((v) => v.id === g.veliId);
      const ogr = sonraki.ogrenciler.find((o) => o.id === g.ogrenciId);
      if (!veli || !ogr || !ogr.veliIds.includes(veli.id)) throw new YetkiHatasi("Bildirim öğrencinin velisine yazılmalı.");
      const subeId = ogrenciSube(sonraki, ogr.id);
      if (!genel && (!subeId || !kap.has(subeId))) reddet("Öğrenci şube kapsamınız dışında.");
      const kanal = gonderimKanali(tanim, veli);
      Object.assign(g, { subeId: subeId ?? g.subeId, alici: `${tamAd(veli)} · ${veli.telefon}`, kanal, maliyet: kanal === "sms" ? smsBoyuMaliyet(onceki, g.metin) : 0 });
      return true;
    }) as unknown as Satir[];
  }

  if (gidenDuyurular.length) {
    const kutu = { ...sonraki, gonderimler: [] as Gonderim[] } as Db;
    for (const du of gidenDuyurular) duyuruGonderimleri(kutu, { ...du, zaman });
    const hedef = (K.gonderimler ??= { yaz: [], sil: [] });
    hedef.yaz.push(...(kutu.gonderimler as unknown as Satir[]));
  }
}

/* =========================== Bölüm 07 yoklama =========================== */
/**
 * Yoklama, veli izni ve devamsızlık bildirimi kuralları (ekranla ortak: src/bolumler/07-yoklama/kurallar.ts):
 * - oturum gerçek olmalı; grup, satır, tarih oturumdan gelir; öğretmen yalnızca kendi dersi
 * - gelecek ve başlamamış ders yok; geçmiş düzeltme yalnızca yönetici
 * - durumlar geçerli, öğrenciler o tarihte grupta aktif (düzeltmede eski satırlar kalır)
 * - öğretmen, konu temizliği ve kayıt zamanı sunucudan; düzeltme eski öğrencileri silemez
 * - izinler yalnızca veli portalından yazılır (/api/veli/izin)
 * - devamsızlık bildirimi: aynı gün aynı metin tekrar gitmez, SMS izni kapalı veliye SMS gitmez
 * - gelmedi kaldırılınca: gitmemiş bildirim kuyruktan silinir; gitmişse veliye bir kez düzeltme mesajı gider
 * Şube kapsamı yazmaDenetle() içinde denetlenir. `temiz` yerinde güncellenir.
 */
export function yoklamaDenetle(onceki: Db, sonraki: Db, temiz: Degisiklik, a: Aktor, zaman: string): void {
  const reddet = (m: Hata) => {
    if (m) throw new YetkiHatasi(m);
  };
  const K = temiz.koleksiyonlar;
  if (K.izinler?.yaz.length) reddet("İzin bildirimi yalnızca veli portalından yapılır.");
  const baglam = { rol: a.kullanici.rol, personelId: a.personel.id, bugun: zaman.slice(0, 10), simdi: zaman.slice(11, 16) };
  for (const y of (K.yoklamalar?.yaz ?? []) as unknown as Yoklama[]) {
    const eski = onceki.yoklamalar[y.oturumId];
    reddet(yoklamaYazmaEngeli(y, eski, sonraki, baglam));
    y.ogretmenId = oturumYedegi(sonraki, y.oturumId)?.ogretmenId ?? sonraki.program.find((p) => p.id === y.satirId)!.ogretmenId; // hak ediş buna dayanır (Bölüm 13); yedek varsa ders yedeğe yazılır
    y.konu = y.konu.trim();
    y.kayitZamani = zaman;
    if (eski) y.durumlar = { ...eski.durumlar, ...y.durumlar };
  }
  const yoklamalar = (K.yoklamalar?.yaz ?? []) as unknown as Yoklama[];
  const smsIzni = (g: Gonderim) => {
    if (g.kanal === "sms" && onceki.veliler.find((v) => v.id === g.veliId)?.izinSms === false) {
      g.kanal = "push";
      g.maliyet = 0;
    }
  };
  if (K.gonderimler) {
    const mevcut: Gonderim[] = [...onceki.gonderimler];
    const yeniMi = (g: Gonderim) => !onceki.gonderimler.some((x) => x.id === g.id);
    K.gonderimler.yaz = (K.gonderimler.yaz as unknown as Gonderim[]).filter((g) => {
      if (!devamsizlikBildirimiMi(g.olay) || !yeniMi(g)) return true;
      // Bildirim gerçek bir "gelmedi" kaydına bağlanır; olay türü ve 7 günlük geç giriş penceresi sunucuda (Bölüm 10 devri)
      const yk = yoklamalar.find((y) => y.durumlar[String(g.ogrenciId)] === "gelmedi");
      if (!yk || devamsizlikOlayi(yk.tarih, baglam.bugun) !== g.olay) return false;
      if (devamsizlikYineleniyor(g, mevcut)) return false;
      mevcut.push(g);
      g.oturumId = yk.oturumId;
      smsIzni(g);
      return true;
    }) as unknown as Satir[];
  }
  // Gelmedi kaldırılan öğrenciler: gitmemiş bildirim silinir, gitmişse düzeltme mesajı
  for (const y of yoklamalar) {
    const eski = onceki.yoklamalar[y.oturumId];
    if (!eski) continue;
    const o = yoklamaOturumu(sonraki, y.oturumId)!;
    for (const ogrId of kaldirilanGelmeyenler(y.durumlar, eski.durumlar)) {
      const plan = duzeltmePlani(oturumBildirimleri(onceki.gonderimler, y.oturumId, y.tarih, ogrId, o.bas), onceki.gonderimler.filter((g) => g.olay === "devamsizlikDuzeltme" && g.oturumId === y.oturumId && g.ogrenciId === ogrId));
      if (!plan.silinecek.length && !plan.veliler.length) continue;
      const hedef = (K.gonderimler ??= { yaz: [], sil: [] });
      hedef.sil.push(...plan.silinecek);
      const kutu = { ...onceki, gonderimler: [] as Gonderim[] } as Db;
      const ders = onceki.dersler.find((x) => x.id === o.satir.dersId)?.ad ?? "";
      bildirimEkle(kutu, "devamsizlikDuzeltme", ogrId, { tarih: tarihMetni(y.tarih), saat: o.bas, ders }, zaman);
      for (const g of kutu.gonderimler.filter((x) => plan.veliler.includes(String(x.veliId)))) {
        g.oturumId = y.oturumId;
        g.subeId = o.subeId;
        smsIzni(g);
        hedef.yaz.push(g as unknown as Satir);
      }
    }
  }
}

/* =========================== Bölüm 08 ödev =========================== */
/**
 * Ödev ve teslim kuralları (ekranla ortak: src/bolumler/08-odevler/kurallar.ts):
 * - modül kapalıyken ödev yazılamaz, silinemez; ödev bildirimi kuyruğa girmez
 * - öğretmen yalnızca bugünkü kendi grubunda, kendi dersinden verir; yalnızca kendi ödevini değiştirir, siler; dersi devralan yalnızca teslim kontrolü yapar
 * - öğretmen, veriliş, kontrol tarihi, ilk teslim alanları sunucudan; grup değişmez; kontrol teslim tarihinden önce yapılamaz, geri alınamaz;
 *   öğretmen kontrolü 7 gün düzeltir, sonrası yönetici
 * - ödev bildirimi gerçek bir ödeve bağlanır (odevId), aynı veliye ikinci kez gitmez; SMS izni kapalı veliye SMS gitmez
 * - "yapmadı" kaldırılınca gitmemiş bildirim kuyruktan silinir; gitmişse veliye bir kez düzeltme mesajı gider
 * Şube kapsamı yazmaDenetle() içinde denetlenir. `temiz` yerinde güncellenir.
 */
export function odevDenetle(onceki: Db, sonraki: Db, temiz: Degisiklik, a: Aktor, zaman: string): void {
  const reddet = (m: Hata) => {
    if (m) throw new YetkiHatasi(m);
  };
  const K = temiz.koleksiyonlar;
  const bugun = zaman.slice(0, 10);
  const ogretmen = a.kullanici.rol === "ogretmen";
  const b: OdevBaglami = { rol: a.kullanici.rol, personelId: a.personel.id, bugun, modulAcik: onceki.moduller?.odev !== false, ogretmenGruplari: ogretmen ? ogretmenGruplari(onceki, a.personel.id, bugun) : null };

  for (const id of K.odevler?.sil ?? []) {
    const eski = onceki.odevler.find((x) => x.id === id);
    if (eski) reddet(odevSilmeEngeli(eski, b));
  }
  const ham = (K.odevler?.yaz ?? []) as unknown as Odev[];
  const yazilan: Odev[] = [];
  for (const s of ham) {
    const eski = onceki.odevler.find((x) => x.id === s.id);
    reddet(odevYazmaEngeli(s, eski, sonraki, b));
    const sahibi = ogretmen ? a.personel.id : (odevOgretmeni(sonraki, s.grupId, s.dersId, bugun) ?? a.personel.id);
    yazilan.push(odevTemizle(s, eski, sahibi, bugun));
  }
  if (K.odevler) K.odevler.yaz = yazilan as unknown as Satir[];
  const eskisi = (o: Odev) => onceki.odevler.find((x) => x.id === o.id);

  // Bildirimin ait olabileceği ödevler: paketteki gerçek değişiklik veya yarın teslim edilecek açık ödev
  const adaylar = (g: Gonderim): Odev[] => {
    if (g.olay === "odevDuzeltme") return []; // düzeltme mesajını yalnızca sunucu üretir
    const ogr = String(g.ogrenciId);
    if (g.olay === "yeniOdev") return yazilan.filter((o) => !eskisi(o) && odevHedefleri(sonraki, o).some((x) => x.id === ogr));
    if (g.olay === "odevYapmadi") return yazilan.filter((o) => !!eskisi(o) && o.teslimler[ogr] === "yapmadi");
    const hedefGun = tarihEkle(bugun, 1);
    return sonraki.odevler.filter((o) => o.teslim === hedefGun && !o.kontrolEdildi && (!ogretmen || o.ogretmenId === a.personel.id) && odevHedefleri(sonraki, o).some((x) => x.id === ogr));
  };
  if (K.gonderimler) {
    const mevcut: Gonderim[] = [...onceki.gonderimler];
    K.gonderimler.yaz = (K.gonderimler.yaz as unknown as Gonderim[]).filter((g) => {
      if (!odevBildirimiMi(g.olay) || onceki.gonderimler.some((x) => x.id === g.id)) return true;
      if (!b.modulAcik) return false;
      const od = adaylar(g).find((o) => !odevBildirimiYineleniyor(g, o.id, mevcut));
      if (!od) return false;
      g.odevId = od.id;
      mevcut.push(g);
      smsIzniUygula(g, onceki.veliler);
      return true;
    }) as unknown as Satir[];
  }
  // "Yapmadı" kaldırıldı: gitmemiş bildirim kuyruktan silinir; gitmişse o veliye bir kez düzeltme mesajı (karar 2026-11-08)
  for (const o of yazilan) {
    const eski = eskisi(o);
    if (!eski) continue;
    for (const ogrId of Object.keys(eski.teslimler).filter((id) => eski.teslimler[id] === "yapmadi" && o.teslimler[id] !== "yapmadi")) {
      const plan = duzeltmePlani(yapmadiBildirimleri(onceki.gonderimler, o, ogrId), onceki.gonderimler.filter((g) => g.olay === "odevDuzeltme" && g.odevId === o.id && g.ogrenciId === ogrId));
      if (!plan.silinecek.length && !plan.veliler.length) continue;
      const hedef = (K.gonderimler ??= { yaz: [], sil: [] });
      hedef.sil.push(...plan.silinecek);
      const kutu = { ...onceki, gonderimler: [] as Gonderim[] } as Db;
      bildirimEkle(kutu, "odevDuzeltme", ogrId, { ders: onceki.dersler.find((x) => x.id === o.dersId)?.ad ?? "", baslik: o.baslik }, zaman);
      for (const g of kutu.gonderimler.filter((x) => plan.veliler.includes(String(x.veliId)))) {
        g.odevId = o.id;
        g.subeId = grupSube(onceki, o.grupId) ?? g.subeId;
        smsIzniUygula(g, onceki.veliler);
        hedef.yaz.push(g as unknown as Satir);
      }
    }
  }
}

/* =========================== Bölüm 09 etüt =========================== */
/**
 * Müsaitlik, randevu ve paket kuralları (ekranla ortak: src/bolumler/09-etut/kurallar.ts):
 * - modül kapalıyken yazılamaz, silinemez; etüt bildirimi kuyruğa girmez
 * - yeni randevu müsait slotta, ileri tarihte; öğretmen, öğrenci çakışması tüm şubelerde aranır; olusturan sunucudan
 * - var olan randevuda yalnızca sonuç değişir; planlıdan bir kez çıkılır; yanlış sonucu yalnızca yönetici gerekçeyle düzeltir (kim, ne zaman sunucudan; işlem kaydına yazılır)
 * - paket hakkını öğrenci bazında sunucu yazar (istemcinin bayat değeri çift düşüm yapamaz); paket satışı öğretmene kapalı
 * - onay bildirimi yeni randevuya bağlanır (randevuId); yönetim iptali ve "paket bitiyor" bildirimini sunucu üretir; SMS izni kapalı veliye SMS gitmez
 * Şube kapsamı ve "öğretmen yalnızca kendi kaydı" yazmaDenetle() içinde. `temiz` yerinde güncellenir.
 */
export function etutDenetle(onceki: Db, sonraki: Db, temiz: Degisiklik, a: Aktor, zaman: string): void {
  const reddet = (m: Hata) => {
    if (m) throw new YetkiHatasi(m);
  };
  const K = temiz.koleksiyonlar;
  const modulAcik = onceki.moduller?.etut !== false;
  const var_ = (k: "musaitlikler" | "randevular" | "paketler") => !!K[k]?.yaz.length || !!K[k]?.sil.length;
  if (!modulAcik && (var_("musaitlikler") || var_("randevular") || var_("paketler"))) reddet("Etüt modülü kapalı.");
  const rol = a.kullanici.rol;
  const ogretmen = rol === "ogretmen";
  const an = { bugun: zaman.slice(0, 10), simdi: zaman.slice(11, 16) };

  for (const m of (K.musaitlikler?.yaz ?? []) as unknown as Musaitlik[]) reddet(musaitlikEngeli(m, sonraki));

  if ("ayarlar" in (temiz.tekil ?? {}) && !kontenjanGecerli((temiz.tekil.ayarlar as { etutGrupKontenjan?: unknown } | undefined)?.etutGrupKontenjan)) reddet("Grup etüdü kontenjanı 1 ile 50 arasında olmalı.");

  const hakDusumu = new Map<string, number>();
  const yeniRandevular: Randevu[] = [];
  const iptalEdilen: Randevu[] = [];
  const ad = `${a.personel.ad} ${a.personel.soyad}`;
  const islem = (baslik: string, metin: string, subeId: string) => {
    const kutu = { ...onceki, islemler: [] } as Db;
    islemYaz(kutu, ad, baslik, metin, subeId);
    (K.islemler ??= { yaz: [], sil: [] }).yaz.push(...kutu.islemler.map((x) => ({ ...x, zaman }) as unknown as Satir));
  };
  const gruplar = ogretmen ? ogretmenGruplari(onceki, a.personel.id, an.bugun) : null;
  for (const r of (K.randevular?.yaz ?? []) as unknown as Randevu[]) {
    const eski = onceki.randevular.find((x) => x.id === r.id);
    if (eski) {
      reddet(randevuDurumEngeli(r, eski, { ...an, rol }));
      for (const [id, f] of sonucHakFarklari(eski, r, onceki.ayarlar.gelmeyenHakDussun)) hakDusumu.set(id, (hakDusumu.get(id) ?? 0) + f);
      if (r.durum === "iptal" && eski.durum !== "iptal") iptalEdilen.push(r);
      if ((r.duzeltmeler?.length ?? 0) > (eski.duzeltmeler?.length ?? 0)) {
        const son = r.duzeltmeler![r.duzeltmeler!.length - 1];
        r.duzeltmeler![r.duzeltmeler!.length - 1] = { neden: son.neden.trim(), kullanici: ad, zaman, onceki: { durum: eski.durum, sonuclar: eski.sonuclar ?? null } };
        islem("Etüt sonucu düzeltme", `${eski.tarih} ${eski.bas}: ${eski.durum} → ${r.durum}. Gerekçe: ${son.neden.trim()}`, eski.subeId);
      }
    } else {
      r.olusturan = "yonetim";
      reddet(randevuYeniEngeli(r, sonraki, { ...an, ogretmenGruplari: gruplar }));
      yeniRandevular.push(r);
    }
  }

  const finans = onceki.moduller?.finans === true;
  const paketYaz: Satir[] = [];
  for (const p of (K.paketler?.yaz ?? []) as unknown as Paket[]) {
    const eski = onceki.paketler.find((x) => x.id === p.id);
    if (eski) {
      reddet(paketDegisimEngeli(p, eski, hakDusumu.get(p.id) ?? 0));
      if (!hakDusumu.has(p.id)) paketYaz.push(eski as unknown as Satir);
      continue;
    }
    if (ogretmen) reddet("Öğretmen paket satışı yapamaz.");
    reddet(paketYeniEngeli(p, sonraki));
    const temizPaket: Paket = { ...p, kalan: p.toplam, fiyat: finans ? p.fiyat : 0, tarih: an.bugun };
    if (temizPaket.fiyat > 0) {
      const taksit = ((K.taksitler?.yaz ?? []) as unknown as Taksit[]).find((t) => t.ogrenciId === p.ogrenciId && t.tutar === p.fiyat && !t.paketId && !onceki.taksitler.some((x) => x.id === t.id));
      if (!taksit) reddet("Paket ücreti ödeme planına aynı işlemde eklenmeli.");
      else taksit.paketId = p.id;
    }
    paketYaz.push(temizPaket as unknown as Satir);
  }
  // Kalan hak: istemcinin gönderdiği değil, o anki değerden düşülmüş hali
  const bitenPaketler: Paket[] = [];
  for (const [id, adet] of hakDusumu) {
    const eski = onceki.paketler.find((x) => x.id === id);
    if (!eski || !adet) continue;
    const yeni = { ...eski, kalan: kalanHakUygula(eski, adet) };
    paketYaz.push(yeni as unknown as Satir);
    if (eski.kalan > 1 && yeni.kalan === 1) bitenPaketler.push(yeni);
  }
  if (paketYaz.length) K.paketler = { yaz: paketYaz, sil: K.paketler?.sil ?? [] };
  const dersAdi = (id: string) => onceki.dersler.find((x) => x.id === id)?.ad ?? "";
  const sonPaket = (id: unknown) => (paketYaz as unknown as Paket[]).find((p) => p.id === id) ?? onceki.paketler.find((p) => p.id === id);

  if (K.gonderimler) {
    const mevcut: Gonderim[] = [...onceki.gonderimler];
    K.gonderimler.yaz = (K.gonderimler.yaz as unknown as Gonderim[]).filter((g) => {
      if (onceki.gonderimler.some((x) => x.id === g.id)) return true;
      if (g.olay === "etutIptal") return false; // yalnızca sunucu üretir
      if (g.olay === "paketBitiyor") {
        // "Veliye bilgi ver" düğmesi: gerçek, bitmek üzere bir pakete bağlanır; otomatik gönderimle aynı tekilleştirme
        const p = sonPaket(g.paketId);
        if (!modulAcik || ogretmen || !p || p.ogrenciId !== g.ogrenciId || p.kalan > 1 || paketBildirimiGitti(mevcut, p, dersAdi(p.dersId))) return false;
        mevcut.push(g);
        smsIzniUygula(g, onceki.veliler);
        return true;
      }
      if (!etutBildirimiMi(g.olay)) return true;
      if (!modulAcik) return false;
      const r = yeniRandevular.find((x) => x.ogrenciIds.includes(String(g.ogrenciId)) && !etutBildirimiYineleniyor(g, x.id, mevcut));
      if (!r) return false;
      g.randevuId = r.id;
      mevcut.push(g);
      smsIzniUygula(g, onceki.veliler);
      return true;
    }) as unknown as Satir[];
  }

  // Sunucunun ürettiği bildirimler (kutu: bildirimEkle yalnızca buraya yazar)
  const uret = (olay: "etutIptal" | "paketBitiyor", ogrenciId: string, degisken: Record<string, string>, subeId: string | null, bag: Partial<Gonderim>) => {
    const kutu = { ...onceki, gonderimler: [] as Gonderim[] } as Db;
    bildirimEkle(kutu, olay, ogrenciId, degisken, zaman, true);
    const hedef = (K.gonderimler ??= { yaz: [], sil: [] });
    const gidenler = [...onceki.gonderimler, ...(hedef.yaz as unknown as Gonderim[])];
    for (const g of kutu.gonderimler) {
      Object.assign(g, bag);
      if (subeId) g.subeId = subeId;
      if (olay === "etutIptal" && etutBildirimiYineleniyor(g, String(bag.randevuId), gidenler)) continue;
      smsIzniUygula(g, onceki.veliler);
      hedef.yaz.push(g as unknown as Satir);
    }
  };
  const ogretmenAdi = (id: string) => { const p = onceki.personel.find((x) => x.id === id); return p ? `${p.ad} ${p.soyad}` : ""; };
  for (const r of iptalEdilen)
    for (const o of r.ogrenciIds) uret("etutIptal", o, { tarih: r.tarih.split("-").reverse().join("."), saat: r.bas, ogretmen: ogretmenAdi(r.ogretmenId) }, r.subeId, { randevuId: r.id });
  for (const p of bitenPaketler) {
    const hedef = [...onceki.gonderimler, ...((K.gonderimler?.yaz ?? []) as unknown as Gonderim[])];
    if (!paketBildirimiGitti(hedef, p, dersAdi(p.dersId))) uret("paketBitiyor", p.ogrenciId, { metin: paketBilgiMetni(dersAdi(p.dersId), p.kalan) }, null, { paketId: p.id });
  }
}

/**
 * Kayıt iptali (karar 2026-11-08): öğrencinin başka süren kaydı yoksa planlı randevuları kapanır, grup etüdünden yalnızca o çıkar.
 * Ekran o randevuları göremeyebilir (ve 09 yetkisi gerekmez), bu yüzden sunucu yazar.
 * İptal hesabı yazıldıysa (finans açık) bedeli hesaba katılan paketlerin kalan hakkı sıfırlanır.
 */
function etutKayitIptali(onceki: Db, temiz: Degisiklik): void {
  const K = temiz.koleksiyonlar;
  const iptaller = ((K.kayitlar?.yaz ?? []) as unknown as Kayit[]).filter((k) => {
    const eski = onceki.kayitlar.find((x) => x.id === k.id);
    return !!eski && eski.durum !== "iptal" && k.durum === "iptal";
  });
  if (!iptaller.length) return;
  const son = farkUygula(onceki, temiz);
  const yerlestir = (k: "randevular" | "paketler", s: Randevu | Paket) => {
    const hedef = (K[k] ??= { yaz: [], sil: [] });
    hedef.yaz = [...hedef.yaz.filter((x) => x.id !== s.id), s as unknown as Satir];
  };
  for (const k of iptaller) {
    if (son.kayitlar.some((x) => x.ogrenciId === k.ogrenciId && x.id !== k.id && (x.durum === "aktif" || x.durum === "dondurulmus"))) continue;
    const ids = new Set([k.ogrenciId]);
    for (const r of son.randevular) if (r.durum === "planli" && r.ogrenciIds.includes(k.ogrenciId)) yerlestir("randevular", ogrencileriCikar(r, ids));
    if (!k.iptalHesabi || onceki.kayitlar.find((x) => x.id === k.id)?.iptalHesabi) continue;
    for (const id of iptalPaketOzeti(onceki, k).paketIds) yerlestir("paketler", { ...son.paketler.find((p) => p.id === id)!, kalan: 0 });
  }
}

/* =========================== Bölüm 05 finans =========================== */
/**
 * Ödeme planı, tahsilat ve kasa kuralları (ekranla ortak: src/bolumler/05-finans/kurallar.ts):
 * - modül kapalıyken yeni taksit, tahsilat, gider, virman yazılamaz; kayda ücret yazılamaz
 *   (yalnızca nakil devri: kalan taksitin şubesi kaydıyla birlikte değişir)
 * - kayıt ücreti fiyat listesinden (sezon + şube + seviye), indirimler tanımlı türler, net = kayitUcreti; kayıtla gelen plan toplamı = net
 * - tahsilat: tutar = dağılım toplamı, kasa = öğrencinin şubesi, ödeyen velinin çocukları, alındığı şube kapsamda;
 *   makbuz no benzersiz (çakışırsa sunucu şubenin sıradaki numarasını verir); değiştirilemez / silinemez, yalnızca yönetici gerekçeyle iptal eder
 * - taksitin ödenen tutarı yalnızca aynı paketteki tahsilat / iptal kadar değişir; fazla tahsilat yok;
 *   tutar / vade değişikliği yalnızca yönetici
 * - gider ve virman değiştirilemez; Genel Merkez yalnızca genel yönetici; virmanda kaynak kasada yeterli bakiye
 * - karar 2026-11-08: sekreterin indirimi "onay bekliyor" (net indirimsiz), onay / ret yalnızca yönetici, onayda açık taksitler
 *   yeniden dağıtılır (planiYenidenDagit); kayıt iptalinde iptal hesabı (kullanılan + cayma → iade veya kalan borç, taksitler kapanır),
 *   iade yalnızca bu pakette ve hesaptaki tutarda; tahsilat, iade, gider, virman yalnızca yönetici gerekçeyle iptal eder (ters kayıt)
 * Şube kapsamı yazmaDenetle() içinde denetlenir. Sistem satırları (nakil devri) da aynı kurallardan geçer. `temiz` yerinde güncellenir.
 */
export function finansDenetle(onceki: Db, temiz: Degisiklik, a: Aktor, zaman: string): void {
  const reddet = (m: Hata) => {
    if (m) throw new YetkiHatasi(m);
  };
  const K = temiz.koleksiyonlar;
  const kayitYaz = (K.kayitlar?.yaz ?? []) as unknown as Kayit[];
  const taksitYaz = (K.taksitler?.yaz ?? []) as unknown as Taksit[];
  const tahsilatYaz = (K.tahsilatlar?.yaz ?? []) as unknown as Tahsilat[];
  const giderYaz = (K.giderler?.yaz ?? []) as unknown as Gider[];
  const virmanYaz = (K.virmanlar?.yaz ?? []) as unknown as Virman[];
  const iadeYaz = (K.iadeler?.yaz ?? []) as unknown as Iade[];
  if (!kayitYaz.length && !taksitYaz.length && !tahsilatYaz.length && !giderYaz.length && !virmanYaz.length && !iadeYaz.length) return;
  const rol = a.kullanici.rol;
  const genel = rol === "genel-yonetici";
  const ad = `${a.personel.ad} ${a.personel.soyad}`;
  const finans = onceki.moduller?.finans === true;
  const bugun = zaman.slice(0, 10);
  // Sunucunun düzelttiği satırlarla (veli birleştirme, nakil devri) son hal
  const son = farkUygula(onceki, temiz);
  /** İptal / indirim onayı paketinde taksitlerin olması gereken tutarı */
  const beklenenTutar = new Map<string, number>();
  /** Kayıt iptalindeki iade tutarı (kayıt kimliği → tutar) */
  const beklenenIade = new Map<string, number>();

  // 1) Kayıt ücreti, indirim onayı, kayıtla birlikte oluşturulan ödeme planı, iptal hesabı
  for (const k of kayitYaz) {
    const eski = onceki.kayitlar.find((x) => x.id === k.id);
    reddet(kayitUcretEngeli(k, eski, son, { rol }));
    if (!eski && finans) reddet(planToplamEngeli(k.net, taksitYaz.filter((t) => t.kayitId === k.id && !onceki.taksitler.some((x) => x.id === t.id))));
    const plan = kayitPlani(onceki.taksitler, k.id);
    // İndirim talebi / kararı: kim ve ne zaman sunucudan
    if (k.bekleyenIndirim && !eski?.bekleyenIndirim) k.bekleyenIndirim = { indirimler: k.bekleyenIndirim.indirimler, isteyen: ad, zaman };
    else if (k.bekleyenIndirim && eski?.bekleyenIndirim) k.bekleyenIndirim = eski.bekleyenIndirim;
    if (eski?.bekleyenIndirim && !k.bekleyenIndirim)
      k.indirimOnay = { karar: ayni(eski.indirimler, k.indirimler) ? "reddedildi" : "onaylandi", indirimler: eski.bekleyenIndirim.indirimler, kullanici: ad, zaman };
    else if (eski?.indirimOnay) k.indirimOnay = eski.indirimOnay;
    else delete k.indirimOnay;
    // Var olan kaydın neti değişirse (indirim onayı) ödenmemiş taksitler yeni nete göre yeniden dağıtılır
    if (eski && kurusa(eski.net) !== kurusa(k.net) && plan.length) {
      const r = planiYenidenDagit(plan, k.net);
      reddet(r.hata);
      for (const [id, tutar] of r.tutarlar) beklenenTutar.set(id, tutar);
    }
    // Kayıt iptali: iptal hesabı (yalnızca iptal paketinde, finans açıkken)
    const iptalOluyor = !!eski && eski.durum !== "iptal" && k.durum === "iptal";
    if (k.iptalHesabi && !ayni(k.iptalHesabi, eski?.iptalHesabi ?? null)) {
      if (!iptalOluyor) reddet("İptal hesabı yalnızca kayıt iptalinde yazılır.");
      if (!finans) reddet("Finans modülü kapalı; iptal hesabı yapılamaz.");
      const sezon = onceki.sezonlar.find((z) => z.id === k.sezonId);
      // Kullanılmamış özel ders paketi bedeli (Bölüm 09, karar 2026-11-08)
      const paket = iptalPaketOzeti(onceki, k);
      reddet(iptalHesabiEngeli(k.iptalHesabi, plan, eski!, sezon, onceki.kurum?.caymaBedeli, { bugun, rol, paketIade: paket.iade }));
      const h = k.iptalHesabi;
      k.iptalHesabi = { ...h, duzeltme: h.duzeltme ? { neden: String(h.duzeltme.neden).trim(), kullanici: ad, zaman } : null };
      for (const [id, tutar] of iptalTaksitleri(plan, h.hak - paket.iade)) beklenenTutar.set(id, tutar);
      for (const [id, tutar] of paket.taksitler) beklenenTutar.set(id, tutar);
      if (h.iade > 0) beklenenIade.set(k.id, h.iade);
    } else if (eski?.iptalHesabi) k.iptalHesabi = eski.iptalHesabi;
    else delete k.iptalHesabi;
  }
  // Hesaplanan taksit tutarları pakette olmalı
  for (const [id, tutar] of beklenenTutar) {
    const eski = onceki.taksitler.find((x) => x.id === id);
    if (eski && kurusa(eski.tutar) !== kurusa(tutar) && !taksitYaz.some((t) => t.id === id))
      reddet("Taksitler iptal / indirim hesabına göre aynı işlemde güncellenmeli.");
  }

  // 1b) İade: yalnızca iptal paketinde, iptal hesabındaki tutarda; iptali yönetici + gerekçe
  const iadeNolar = (onceki.iadeler ?? []).map((i) => i.makbuzNo);
  const iadeli = new Set<string>();
  for (const i of iadeYaz) {
    const eski = (onceki.iadeler ?? []).find((x) => x.id === i.id);
    if (eski) {
      if (!finans) reddet("Finans modülü kapalı; iade iptal edilemez.");
      reddet(finansIptalEngeli(eski, i, rol, "İade"));
      continue;
    }
    if (iadeli.has(i.kayitId)) reddet("Bir kayıt iptalinde tek iade oluşturulur.");
    iadeli.add(i.kayitId);
    reddet(iadeEngeli(i, son, { finans, rol, beklenenTutar: beklenenIade.get(i.kayitId) }));
    const kod = onceki.subeler.find((s) => s.id === i.subeId)?.kod ?? "SUB";
    if (iadeNolar.includes(i.makbuzNo) || !i.makbuzNo.startsWith(`${kod}-I-`)) i.makbuzNo = yeniMakbuzNo(kod, iadeNolar, "I");
    iadeNolar.push(i.makbuzNo);
    i.kullanici = ad;
    i.zaman = zaman;
  }
  for (const id of beklenenIade.keys()) if (!iadeli.has(id)) reddet("İptal hesabında iade çıktı; iade kaydı aynı işlemde oluşturulmalı.");

  // 2) Tahsilat ve iptal
  const yeniler: Tahsilat[] = [];
  const iptaller: Tahsilat[] = [];
  const nolar = onceki.tahsilatlar.map((t) => t.makbuzNo);
  for (const t of tahsilatYaz) {
    const eski = onceki.tahsilatlar.find((x) => x.id === t.id);
    if (eski) {
      reddet(tahsilatIptalEngeli(eski, t, rol));
      reddet(tahsilatKayitIptalEngeli(eski, son)); // aynı pakette iptal edilen kayıt da sayılır
      iptaller.push(eski);
      continue;
    }
    reddet(tahsilatEngeli(t, son, { finans, kapsam: genel ? undefined : kapsam(onceki, a.kullanici) }));
    // Makbuz no benzersiz: ekran başka kullanıcının aynı anda aldığı tahsilatı göremeyebilir
    const kod = onceki.subeler.find((s) => s.id === t.subeId)?.kod ?? "SUB";
    if (nolar.includes(t.makbuzNo) || !t.makbuzNo.startsWith(`${kod}-M-`)) t.makbuzNo = yeniMakbuzNo(kod, nolar);
    nolar.push(t.makbuzNo);
    yeniler.push(t);
  }

  // 3) Taksit: ödenen tutar yalnızca tahsilat / iptal kadar değişir
  const farklar = odemeFarklari(yeniler, iptaller);
  for (const [id, f] of farklar) if (f !== 0 && !taksitYaz.some((t) => t.id === id)) reddet("Tahsilatın dağıtıldığı taksit aynı işlemde güncellenmeli.");
  for (const t of taksitYaz)
    reddet(taksitYazmaEngeli(t, onceki.taksitler.find((x) => x.id === t.id), son, { finans, rol, odenenFarki: farklar.get(t.id) ?? 0, beklenenTutar: beklenenTutar.get(t.id) }));

  // 4) Gider ve virman (iptal: yönetici + gerekçe, ters kayıt)
  for (const g of giderYaz) reddet(giderEngeli(g, onceki.giderler.find((x) => x.id === g.id), onceki, { finans, genel, bugun, rol }));
  if (virmanYaz.length) {
    const virmanlar = [...onceki.virmanlar];
    for (const v of virmanYaz) {
      const hareketler = kasaHareketleri({ ...onceki, virmanlar });
      reddet(virmanEngeli(v, onceki.virmanlar.find((x) => x.id === v.id), onceki, { finans, genel, bugun, rol, bakiye: (kasa) => kasaBakiyesi(hareketler, kasa) }));
      virmanlar.push(v);
    }
  }
}

/* =========================== Bölüm 13 personel ve hak ediş =========================== */
/**
 * Personel kartı, avans, hak ediş durumu ve etüt ücreti (ekranla ortak: src/bolumler/13-personel/kurallar.ts):
 * - maskeli gönderilen alanlar (iletişim, ücret, maaş gideri açıklaması) yazarken eski değerle korunur
 * - kart: alan kuralları, tek biçim, yinelenen telefon / e-posta (kurum genelinde), yetki yükseltme yok, kendi görevi / şubesi / ücreti değişmez
 * - dersi veya planlı etüdü olan öğretmen pasife alınamaz, görevi değişmez, o şubeden çıkarılamaz
 * - silme yalnızca içe aktarma geri alınırken ve bağlı kayıt yokken; iceAktarmaId istemciden gelmez
 * - avans: değişmez, tarih sunucudan, aynı pakette eşleşen Maaş gideriyle
 * - hak ediş durumu: yok → onaylandi → odendi, ay bitince; ödeme yalnızca genel yönetici ve hesaplanan şube dağılımıyla
 * Şube kapsamı yazmaDenetle() içinde. `temiz` yerinde güncellenir.
 */
export function personelDenetle(onceki: Db, sonraki: Db, temiz: Degisiklik, a: Aktor, zaman: string): void {
  const reddet = (m: Hata) => {
    if (m) throw new YetkiHatasi(m);
  };
  const K = temiz.koleksiyonlar;
  const tekil = temiz.tekil ?? {};
  const bugun = zaman.slice(0, 10);
  const rol = a.kullanici.rol;
  const genel = rol === "genel-yonetici";
  const ad = `${a.personel.ad} ${a.personel.soyad}`;
  const yetki13 = yetki(onceki, a, "13");
  const goren: Goren = { rol, personelId: a.personel.id, yetki13 };
  const kap = new Set(kapsam(onceki, a.kullanici));
  const tamKapsam = (p: Personel | undefined) => genel || (!!p && p.subeIds.length > 0 && p.subeIds.every((x) => kap.has(x)));
  const moduller = { hakedisAcik: onceki.moduller?.hakedis === true, finansAcik: onceki.moduller?.finans === true };

  if ("kurum" in tekil) reddet(etutUcretiEngeli((tekil.kurum as Kurum | undefined)?.etutDersUcreti));

  // Personel kartı
  if (K.personel) {
    const aktarilanlar = new Set((K.iceAktarmalar?.yaz ?? []).map((x) => String(x.id)));
    K.personel.yaz = (K.personel.yaz as unknown as Personel[]).map((ham) => {
      const eski = onceki.personel.find((x) => x.id === ham.id);
      const s = personelTemizle(maskeliAlanlariKoru(ham, eski, goren));
      if (eski?.iceAktarmaId) s.iceAktarmaId = eski.iceAktarmaId;
      else if (!s.iceAktarmaId || !aktarilanlar.has(s.iceAktarmaId)) delete s.iceAktarmaId;
      reddet(personelYazmaEngeli(s, eski, sonraki, { rol, personelId: a.personel.id }, bugun));
      return s;
    }) as unknown as Satir[];
    for (const id of K.personel.sil) reddet(personelSilmeEngeli(id, onceki));
  }

  // Maskeli maaş gideri iptal edilirken açıklama eski haliyle kalır
  if (!genel && !yetki13)
    for (const g of (K.giderler?.yaz ?? []) as unknown as Gider[]) {
      const eski = onceki.giderler.find((x) => x.id === g.id);
      if (eski) g.aciklama = eski.aciklama;
    }
  const yeniGiderler = ((K.giderler?.yaz ?? []) as unknown as Gider[]).filter((g) => !onceki.giderler.some((x) => x.id === g.id));

  // Avans
  if (K.avanslar) {
    if (K.avanslar.sil.length) reddet("Avans kaydı silinemez.");
    K.avanslar.yaz = (K.avanslar.yaz as unknown as Avans[]).map((av) => {
      if (onceki.avanslar.some((x) => x.id === av.id)) reddet("Avans kaydı değiştirilemez.");
      const p = onceki.personel.find((x) => x.id === av.personelId);
      reddet(avansEngeli(av, p, { ...moduller, tamKapsam: tamKapsam(p) }));
      const g = yeniGiderler.find((x) => x.id === av.giderId);
      if (!g || g.kategori !== MAAS_KATEGORISI || kurusa(g.tutar) !== kurusa(av.tutar) || g.subeId !== av.subeId) throw new YetkiHatasi("Avans gideri aynı işlemde, aynı tutarla yazılmalı.");
      g.tarih = bugun;
      return { ...av, tarih: bugun, aciklama: av.aciklama.trim() || "Avans" };
    }) as unknown as Satir[];
  }

  // Hak ediş durumu: kapsam dışı satırlar istemciye gitmez, burada korunur
  const eskiDurum = onceki.hakedisDurum ?? {};
  let sonDurum: Record<string, HakedisDegeri> | null = null;
  if ("hakedisDurum" in tekil) {
    const gelen = tekil.hakedisDurum;
    if (!gelen || typeof gelen !== "object" || Array.isArray(gelen)) throw new YetkiHatasi("Hak ediş durumu geçersiz.");
    const yeni = gelen as Record<string, HakedisDegeri>;
    const gorunur = (k: string) => genel || onceki.personel.some((p) => p.id === hakedisAnahtari(k)?.personelId && p.subeIds.some((x) => kap.has(x)));
    for (const k of Object.keys(eskiDurum)) if (!(k in yeni) && gorunur(k)) reddet("Hak ediş durumu geri alınamaz.");
    const durumlar: Record<string, HakedisDegeri> = { ...eskiDurum };
    for (const [k, deger] of Object.entries(yeni)) {
      const eskiK = hakedisKaydi(eskiDurum[k]);
      const gelenK = hakedisKaydi(deger);
      const anahtar = hakedisAnahtari(k);
      const p = onceki.personel.find((x) => x.id === anahtar?.personelId);
      const baglam = { ...moduller, rol, bugun, tamKapsam: tamKapsam(p), personel: onceki.personel };
      let kayit: HakedisKaydi = eskiK;
      const duzeltmeDegisti = gelenK.duzeltme?.tutar !== eskiK.duzeltme?.tutar || gelenK.duzeltme?.neden?.trim() !== eskiK.duzeltme?.neden;
      if (duzeltmeDegisti) {
        reddet(hakedisDuzeltmeEngeli(k, gelenK.duzeltme, eskiK, baglam));
        const { duzeltme: _d, ...kalan } = eskiK;
        void _d;
        kayit = gelenK.duzeltme ? { ...kalan, duzeltme: { tutar: gelenK.duzeltme.tutar, neden: gelenK.duzeltme.neden.trim(), kullanici: ad, zaman } } : kalan;
        durumlar[k] = kayit;
        const islemler = (K.islemler ??= { yaz: [], sil: [] });
        islemler.yaz.push({ id: `ik-hd-${k}-${zaman}`.replace(/[^A-Za-z0-9_\-:.]/g, "-").slice(0, 80), zaman, kullanici: ad, islem: "Hak ediş düzeltmesi", detay: `${p!.ad} ${p!.soyad} — ${anahtar!.ay}: ${gelenK.duzeltme ? `${gelenK.duzeltme.tutar} TL · ${gelenK.duzeltme.neden.trim()}` : "kaldırıldı"}`, subeId: p!.anaSubeId });
      }
      if (gelenK.durum === eskiK.durum) continue;
      reddet(hakedisDurumEngeli(k, gelenK.durum, eskiK.durum, baglam));
      if (gelenK.durum !== "odendi") {
        durumlar[k] = { ...kayit, durum: gelenK.durum };
        continue;
      }
      // Ödeme finansa hesaplanan şube dağılımıyla düşer; tutar istemciden alınmaz, ödeme anında dondurulur
      const h = hakEdisHesabi({ ...onceki, hakedisDurum: durumlar }, p!, anahtar!.ay);
      const aciklama = odemeAciklamasi(p!, anahtar!.ay);
      const giderler = yeniGiderler.filter((g) => g.kategori === MAAS_KATEGORISI && g.aciklama === aciklama);
      const uyumlu = giderler.length === h.dagilim.length && h.dagilim.every((x) => giderler.some((g) => g.subeId === x.subeId && kurusa(g.tutar) === kurusa(x.tutar)));
      if (!uyumlu) reddet("Ödeme tutarı hesaplanan hak edişle uyuşmuyor; sayfayı yenileyip tekrar deneyin.");
      for (const g of giderler) g.tarih = bugun;
      durumlar[k] = { ...kayit, durum: "odendi", donmus: donmusOlustur(h, giderler.map((g) => g.id)) };
      for (const f of h.farkKaynak) durumlar[`${f.ay}_${p!.id}`] = farkAktar(durumlar[`${f.ay}_${p!.id}`], f.tutar);
    }
    sonDurum = durumlar;
  }

  // Ödeme gideri iptal edilince hak ediş "onaylandı"ya döner, dondurulan tutar temizlenir; diğer şubelerin gideri birlikte iptal olur
  const giderYaz = (K.giderler?.yaz ?? []) as unknown as Gider[];
  const islenen = new Set<string>();
  for (const g of [...giderYaz]) {
    const eski = onceki.giderler.find((x) => x.id === g.id);
    if (!eski || eski.iptal || !g.iptal || eski.kategori !== MAAS_KATEGORISI) continue;
    const kaynak = sonDurum ?? eskiDurum;
    const bulunan = Object.entries(kaynak).find(([k, v]) => {
      const r = hakedisKaydi(v);
      const an = hakedisAnahtari(k);
      const p = onceki.personel.find((x) => x.id === an?.personelId);
      return r.durum === "odendi" && !!p && !!an && (r.donmus?.giderIds.includes(g.id) || eski.aciklama === odemeAciklamasi(p, an.ay));
    });
    if (!bulunan || islenen.has(bulunan[0])) continue;
    const [k, v] = bulunan;
    islenen.add(k);
    const r = hakedisKaydi(v);
    const an = hakedisAnahtari(k)!;
    const p = onceki.personel.find((x) => x.id === an.personelId)!;
    const aciklama = odemeAciklamasi(p, an.ay);
    for (const s of onceki.giderler) {
      if (s.id === g.id || s.iptal || !(r.donmus?.giderIds.includes(s.id) || s.aciklama === aciklama) || giderYaz.some((x) => x.id === s.id)) continue;
      if (!genel && !kap.has(s.subeId)) reddet("Bu ödemenin başka şubedeki gideri de var; iptali genel yönetici yapar.");
      giderYaz.push({ ...s, iptal: g.iptal });
    }
    const durumlar = { ...kaynak };
    for (const f of r.donmus?.farkKaynak ?? []) durumlar[`${f.ay}_${p.id}`] = farkAktar(durumlar[`${f.ay}_${p.id}`], -f.tutar);
    const { donmus: _m, ...kalan } = r;
    void _m;
    durumlar[k] = { ...kalan, durum: "onaylandi" };
    sonDurum = durumlar;
  }
  if (sonDurum) temiz.tekil.hakedisDurum = sonDurum;
}

/* =========================== Bölüm 04 öğrenci, veli ve kayıt =========================== */
/**
 * Öğrenci, veli ve kayıt kuralları (ekranla ortak: src/bolumler/04-ogrenciler/kurallar.ts):
 * - yeni velinin telefonu kayıtlı bir veliye aitse (başka şubede olsa da) yeni veli yazılmaz, öğrenci mevcut veliye bağlanır
 * - veli: ad, geçerli telefon (tek biçim), e-posta, yakınlık; var olan velinin telefonu başka veliye ait olamaz
 * - öğrenci: alan kuralları, kayıtla birlikte oluşturulur, notlar yalnızca eklenir, mükerrer öğrenci kurum genelinde engellenir,
 *   "ayrıldı" yalnızca tüm kayıtlar iptal edilince; KVKK anonimleştirmesi yalnızca 14 yetkisiyle
 * - kayıt: benzersiz sözleşme no (şube koduyla), aktif şube, grubun şube/sezon uyumu, aktif sezon (genel yönetici hariç),
 *   sezonda tek ana kayıt, durum geçişi (iptal ve mezuniyet geri alınamaz; mezuniyeti genel yönetici işaretler), grup geçmişi
 *   yalnızca eklenir, kapasite aşımını sekreter / şube müdürü / genel yönetici onaylar
 * - öğrencinin durumu kayıtlarıyla uyumlu olmalı (ogrenciDurumu); ayrılan / mezun öğrenci mevcut karttan yeni kayıtla aktifleşir
 * - kapsam dışındaki aktif şubeye nakil (karar 2026-11-07): kapsamDisiNakilEngeli; grup ve kalan taksit devri sunucudan
 * - kayıt iptali öğrencinin son kaydıysa bağlı aday aynı pakette yeniden açılır (karar 2026-11-07; aday başka şubede olsa da)
 * Şube kapsamı (nakilde eski ve yeni şube) yazmaDenetle() içinde denetlenir. `temiz` yerinde güncellenir.
 */
export function kayitDenetle(onceki: Db, sonraki: Db, temiz: Degisiklik, a: Aktor, zaman: string): void {
  const reddet = (m: Hata) => {
    if (m) throw new YetkiHatasi(m);
  };
  const K = temiz.koleksiyonlar;
  if (!K.veliler?.yaz.length && !K.ogrenciler?.yaz.length && !K.kayitlar?.yaz.length) return;
  const bugun = zaman.slice(0, 10);
  const kvkkYetkisi = yetki(onceki, a, "14");
  const ogrYaz = (K.ogrenciler?.yaz ?? []) as unknown as Ogrenci[];
  const kayitYaz = (K.kayitlar?.yaz ?? []) as unknown as Kayit[];

  // 0) Sözleşme no çakışması: ekran başka şubeye nakledilmiş kayıtları göremediği için aynı numarayı üretebilir;
  //    yeni kayda sunucu şube ve sezon yılındaki sıradaki numarayı verir (numara hiçbir zaman iki kayıtta olmaz)
  const nolar = onceki.kayitlar.map((k) => k.sozlesmeNo);
  for (const k of kayitYaz) {
    if (onceki.kayitlar.some((x) => x.id === k.id) || typeof k.sozlesmeNo !== "string") continue;
    if (nolar.includes(k.sozlesmeNo)) k.sozlesmeNo = yeniSozlesmeNo(onceki, nolar, k.subeId, k.sezonId, bugun);
    nolar.push(k.sozlesmeNo);
  }

  // 1) Kayıtlı telefona sahip yeni veli → mevcut veli (ekran başka şubedeki veliyi göremeyebilir)
  const yeniVeliler = ((K.veliler?.yaz ?? []) as unknown as Veli[]).filter((v) => !onceki.veliler.some((x) => x.id === v.id));
  const birlestir = veliBirlestirmeleri(yeniVeliler, onceki.veliler);
  if (birlestir.size) {
    const es = (id: string) => birlestir.get(id) ?? id;
    K.veliler!.yaz = K.veliler!.yaz.filter((v) => !birlestir.has(String(v.id)));
    for (const o of ogrYaz) {
      if (Array.isArray(o.veliIds)) o.veliIds = [...new Set(o.veliIds.map(es))];
      o.birincilVeliId = es(o.birincilVeliId);
    }
    for (const t of K.taksitler?.yaz ?? []) t.veliId = es(String(t.veliId));
    for (const g of K.gonderimler?.yaz ?? []) if (g.veliId) g.veliId = es(String(g.veliId));
  }
  const veliYaz = (K.veliler?.yaz ?? []) as unknown as Veli[];
  const yerine = <T extends { id: string }>(liste: T[], yaz: T[]) => liste.map((x) => yaz.find((y) => y.id === x.id) ?? x);
  const son = {
    ...sonraki,
    veliler: yerine(sonraki.veliler.filter((v) => !birlestir.has(v.id)), veliYaz),
    ogrenciler: yerine(sonraki.ogrenciler, ogrYaz),
    kayitlar: yerine(sonraki.kayitlar, kayitYaz),
  };

  for (const v of veliYaz) reddet(veliYazmaEngeli(v, onceki.veliler.find((x) => x.id === v.id), son, { kvkkYetkisi }));
  for (const o of ogrYaz) reddet(ogrenciYazmaEngeli(o, onceki.ogrenciler.find((x) => x.id === o.id), son, { kvkkYetkisi, bugun }));
  const genel = a.kullanici.rol === "genel-yonetici";
  const kap = kapsam(onceki, a.kullanici);
  for (const k of kayitYaz) {
    const eski = onceki.kayitlar.find((x) => x.id === k.id);
    // Kapsam dışındaki aktif şubeye nakil: yalnızca şube/grup/grup geçmişi değişir, grup sunucuca atanır, kontenjan aşılmaz
    if (eski && eski.subeId !== k.subeId) {
      if (!genel && !kap.includes(k.subeId)) reddet(kapsamDisiNakilEngeli(k, eski, son));
      // Kalan taksitler yeni şubeye devredilir. Ekran kapsam dışına taksit yazamaz; finans kapalıyken veya
      // finans yetkisi yokken taksitleri hiç görmez (Bölüm 05 · okumaSuz). Devri her nakilde sunucu tamamlar.
      const tk = (K.taksitler ??= { yaz: [], sil: [] });
      for (const t of onceki.taksitler)
        if (t.kayitId === k.id && taksitKalan(t) > 0 && t.subeId !== k.subeId && !tk.yaz.some((x) => x.id === t.id)) tk.yaz.push({ ...t, subeId: k.subeId } as unknown as Satir);
    }
    reddet(kayitYazmaEngeli(k, eski, son, { rol: a.kullanici.rol }));
  }
  // Öğrencinin durumu kayıtlarıyla uyumlu olmalı (iptal → ayrıldı, mezuniyet → mezun, yeniden kayıt → aktif)
  for (const id of new Set(kayitYaz.map((k) => k.ogrenciId))) {
    const o = son.ogrenciler.find((x) => x.id === id);
    const hesap = ogrenciDurumu(id, son.kayitlar);
    if (o && !ogrenciAnonimMi(o) && o.durum !== hesap)
      reddet(`Öğrencinin durumu kayıtlarıyla uyumlu olmalı: “${{ aktif: "aktif", ayrildi: "ayrıldı", mezun: "mezun" }[hesap]}” durumuna alınmalı.`);
  }

  // 2) Kayıt iptali: bağlı aday yeniden açılır
  const ad = `${a.personel.ad} ${a.personel.soyad}`;
  for (const k of kayitYaz) {
    if (k.durum !== "iptal" || onceki.kayitlar.find((x) => x.id === k.id)?.durum === "iptal") continue;
    if (!iptalPaketiMi(k.ogrenciId, onceki.kayitlar, kayitYaz, son.kayitlar)) continue;
    const o = son.ogrenciler.find((x) => x.id === k.ogrenciId);
    if (!o || ogrenciAnonimMi(o)) continue; // KVKK silmesinde aday takibe açılmaz
    const aday = bagliAday(k.ogrenciId, onceki.adaylar);
    if (!aday) continue;
    const ay = (K.adaylar ??= { yaz: [], sil: [] });
    if (ay.yaz.some((x) => x.id === aday.id)) continue; // ekran gönderdiyse onKayitDenetle denetler
    ay.yaz.push(adayYenidenAc(aday, { tarih: zaman, yazar: ad, metin: `Kayıt iptal edildi (${k.sozlesmeNo}); aday yeniden açıldı.` }, bugun) as unknown as Satir);
  }
}

/* =========================== Bölüm 03 ön kayıt =========================== */
/**
 * Aday (ön kayıt) kuralları (ekranla ortak: src/bolumler/03-on-kayit/kurallar.ts):
 * - "onKayit" modülü kapalıyken aday yazılamaz (yalnızca KVKK anonimleştirmesi)
 * - Bölüm 03 yetkisi olmayan (yalnızca 04) aktör yalnızca kesin kayıt dönüşümü yapabilir
 * - alan kuralları (veli adı, telefon, sınıf, tarih, vazgeçme nedeni, teklif), durum geçişi (kayıt geri alınamaz),
 *   notlar yalnızca eklenir, kesin kayıtta öğrenci kartı aynı pakette olmalı, aktif şube, şubede görevli sorumlu,
 *   yinelenen açık aday engeli. Şube kapsamı yazmaDenetle() içinde (eski + yeni hal) denetlenir;
 *   tek istisna kapsam dışındaki aktif şubeye devirdir (adayDevirEngeli: yalnızca şube/sorumlu/not değişir).
 */
export function onKayitDenetle(onceki: Db, sonraki: Db, temiz: Degisiklik, a: Aktor): void {
  const yaz = (temiz.koleksiyonlar.adaylar?.yaz ?? []) as unknown as Aday[];
  if (!yaz.length) return;
  const secenek = { modulAcik: onceki.moduller.onKayit !== false, onKayitYetkisi: yetki(onceki, a, "03"), kvkkYetkisi: yetki(onceki, a, "14"),
    kapsam: a.kullanici.rol === "genel-yonetici" ? undefined : kapsam(onceki, a.kullanici) };
  // Sunucunun düzelttiği alanlarla (telefon biçimi, notlar) son hal
  const adaylar = sonraki.adaylar.map((x) => yaz.find((y) => y.id === x.id) ?? x);
  const kayitYaz = (temiz.koleksiyonlar.kayitlar?.yaz ?? []) as unknown as Kayit[];
  const kayitlar = sonraki.kayitlar.map((x) => kayitYaz.find((y) => y.id === x.id) ?? x);
  for (const s of yaz) {
    const eski = onceki.adaylar.find((x) => x.id === s.id);
    // Tek istisna (karar 2026-11-07): kayıt iptaliyle aynı pakette kayda dönüşmüş aday yeniden açılır (Bölüm 04)
    if (eski?.durum === "kayit" && s.durum !== "kayit" && eski.ogrenciId && iptalPaketiMi(eski.ogrenciId, onceki.kayitlar, kayitYaz, kayitlar)) {
      const m = adayYenidenAcmaEngeli(s, eski);
      if (m) throw new YetkiHatasi(m);
      continue;
    }
    const m = adayYazmaEngeli(s, eski, { ...sonraki, adaylar }, secenek);
    if (m) throw new YetkiHatasi(m);
  }
}

/* =========================== Bölüm 02 kullanıcılar =========================== */
/**
 * Kullanıcı hesabı ve rol yetki tablosu kuralları (ekranla ortak: src/bolumler/02-kullanicilar/kurallar.ts):
 * - alan kuralları: geçerli rol, personel kartı, benzersiz e-posta (büyük/küçük harf ve İ/I/ı farkı yok), şube kapsamı
 * - yetki yükseltme: genel yönetici olmayan aktör kendinden yetkili rol atayamaz, yetkili hesabı değiştiremez/silemez
 * - kendi hesabı: kendi rolü, şube kapsamı değişmez; kendini pasife alamaz / silemez
 * - personel pasife alınınca bağlı hesap da pasife alınır (oturumları uygulama.ts kapatır)
 * - her zaman en az bir aktif genel yönetici kalır
 * - rol yetki tablosu tam ve boolean olmalı; genel yöneticinin bölümleri kapatılamaz
 * `temiz` yerinde güncellenir (zincirleme pasife alma eklenir).
 */
export function kullaniciDenetle(onceki: Db, sonraki: Db, temiz: Degisiklik, a: Aktor): void {
  const reddet = (m: Hata) => {
    if (m) throw new YetkiHatasi(m);
  };
  const ben = a.kullanici;
  const kap = kapsam(onceki, ben);

  if ("rolYetkileri" in (temiz.tekil ?? {})) reddet(rolYetkileriDogrula(temiz.tekil.rolYetkileri));

  const kullaniciYaz = (temiz.koleksiyonlar.kullanicilar?.yaz ?? []) as unknown as Kullanici[];
  const kullaniciSil = temiz.koleksiyonlar.kullanicilar?.sil ?? [];

  // Personel pasife alındıysa bağlı aktif hesap da pasife alınır (hesabı görmeyen şube müdürü de pasife alabilsin)
  const zincir: Kullanici[] = [];
  for (const p of (temiz.koleksiyonlar.personel?.yaz ?? []) as unknown as Personel[]) {
    if (p.aktif !== false) continue;
    const k = sonraki.kullanicilar.find((x) => x.personelId === p.id);
    if (!k || !k.aktif || kullaniciYaz.some((x) => x.id === k.id && !x.aktif)) continue;
    if (k.id === ben.id) reddet("Kendi hesabınızı pasife alamazsınız.");
    reddet(yonetimEngeli(ben, k, kap) && "Bu personelin kullanıcı hesabını yönetme yetkiniz yok; pasife alma genel yöneticiye bırakılmalı.");
    zincir.push({ ...k, aktif: false });
  }

  if (!kullaniciYaz.length && !kullaniciSil.length && !zincir.length) return;

  for (const s of kullaniciYaz) {
    const eski = onceki.kullanicilar.find((x) => x.id === s.id);
    if (eski) {
      reddet(yonetimEngeli(ben, eski, kap));
      if (eski.id === ben.id) reddet(kendiHesabiEngeli(eski, s));
    }
    reddet(kullaniciDogrula(s, sonraki));
    reddet(rolAtamaEngeli(ben.rol, s.rol));
    reddet(yonetimEngeli(ben, s, kap));
  }
  for (const id of kullaniciSil) {
    const eski = onceki.kullanicilar.find((x) => x.id === id);
    if (!eski) continue;
    if (eski.id === ben.id) reddet("Kendi hesabınızı silemezsiniz.");
    reddet(yonetimEngeli(ben, eski, kap));
  }

  if (zincir.length) {
    const k = (temiz.koleksiyonlar.kullanicilar ??= { yaz: [], sil: [] });
    k.yaz = [...k.yaz.filter((x) => !zincir.some((z) => z.id === x.id)), ...(zincir as unknown as Satir[])];
  }
  const sonListe = sonraki.kullanicilar.map((k) => zincir.find((z) => z.id === k.id) ?? k);
  reddet(sonGenelYoneticiEngeli(sonListe));
}

/* =========================== Bölüm 01 tanımları =========================== */
/**
 * Kurum yapısı tanımlarının iş kuralları (boş/yinelenen ad, çakışan ders saati, bağlı kayıt varken silme,
 * tek aktif sezon, grubun şube/sezon değişmezliği, pasif derslik/ders saatine yeni atama…) ekrana güvenilmeden sunucuda da uygulanır.
 * Kurallar ekranla ortaktır: src/bolumler/01-kurum-yapisi/kurallar.ts
 */
export function tanimDenetle(onceki: Db, sonraki: Db, d: Degisiklik): void {
  const reddet = (m: Hata) => {
    if (m) throw new YetkiHatasi(m);
  };
  const yazilan = <T>(k: Koleksiyon) => (d.koleksiyonlar[k]?.yaz ?? []) as unknown as T[];
  const silinen = (k: Koleksiyon) => d.koleksiyonlar[k]?.sil ?? [];

  for (const s of yazilan<Sube>("subeler")) {
    reddet(subeDogrula(s, sonraki.subeler));
    const eski = onceki.subeler.find((x) => x.id === s.id);
    if (eski?.aktif && s.aktif === false) reddet(subePasifeAlmaEngeli(s.id, onceki.kayitlar, onceki.sezonlar.find((z) => z.aktif)?.id));
  }

  if (d.koleksiyonlar.sezonlar) {
    for (const s of yazilan<Sezon>("sezonlar")) reddet(sezonDogrula(s, sonraki.sezonlar));
    reddet(aktifSezonDenetle(sonraki.sezonlar));
  }

  for (const x of yazilan<Ders>("dersler")) reddet(dersDogrula(x, sonraki.dersler));

  for (const x of yazilan<Derslik>("derslikler")) {
    reddet(derslikDogrula(x, sonraki.derslikler));
    const eski = onceki.derslikler.find((y) => y.id === x.id);
    if (eski && eski.subeId !== x.subeId) reddet("Derslik başka şubeye taşınamaz.");
  }
  for (const id of silinen("derslikler")) reddet(derslikSilmeEngeli(id, sonraki));

  for (const h of yazilan<DersSaati>("dersSaatleri")) {
    reddet(dersSaatiDogrula(h, sonraki.dersSaatleri));
    const eski = onceki.dersSaatleri.find((y) => y.id === h.id);
    if (eski && eski.subeId !== h.subeId) reddet("Ders saati başka şubeye taşınamaz.");
  }
  for (const id of silinen("dersSaatleri")) reddet(dersSaatiSilmeEngeli(id, sonraki.program));

  // Pasif derslik/ders saati yeni program satırına atanamaz; yalnızca değişen alan denetlenir
  for (const p of yazilan<ProgramSatiri>("program")) reddet(programAtamaEngeli(p, onceki.program.find((y) => y.id === p.id), sonraki));

  for (const g of yazilan<Grup>("gruplar")) {
    const eski = onceki.gruplar.find((x) => x.id === g.id);
    // Derslik ve rehber yalnızca değiştiyse denetlenir (eski veride sonradan değişen atamalar kaydı kilitlemesin)
    reddet(grupDogrula({ ...g, derslikId: g.derslikId !== eski?.derslikId ? g.derslikId : "" }, sonraki));
    if (!sonraki.subeler.some((s) => s.id === g.subeId)) reddet("Grubun şubesi bulunamadı.");
    if (!sonraki.sezonlar.some((s) => s.id === g.sezonId)) reddet("Grubun sezonu bulunamadı.");
    if (eski) {
      if (eski.subeId !== g.subeId || eski.sezonId !== g.sezonId) reddet("Grubun şubesi ve sezonu sonradan değiştirilemez.");
      if (eski.seviye !== g.seviye && onceki.kayitlar.some((k) => k.grupId === g.id && k.durum !== "iptal"))
        reddet("Kayıtlı öğrencisi olan grubun seviyesi değiştirilemez.");
    }
    if (g.rehberId && g.rehberId !== eski?.rehberId) {
      const p = sonraki.personel.find((x) => x.id === g.rehberId);
      if (!p || !p.aktif || !p.subeIds.includes(g.subeId)) reddet("Rehber öğretmen bu şubede görevli aktif bir personel olmalı.");
    }
  }

  const tekil = d.tekil ?? {};
  if ("kurum" in tekil) {
    reddet(kurumDogrula(tekil.kurum as Kurum));
    reddet(caymaBedeliEngeli((tekil.kurum as Kurum | undefined)?.caymaBedeli)); // Bölüm 05, karar 2026-11-08
  }
  if ("fiyatListesi" in tekil) reddet(fiyatListesiDogrula(tekil.fiyatListesi, sonraki));
  if ("moduller" in tekil) {
    const m = tekil.moduller;
    if (!m || typeof m !== "object" || Object.values(m as object).some((v) => typeof v !== "boolean")) reddet("Modül ayarı geçersiz.");
  }
}

/* =========================== Veli =========================== */
/** Veliye özel görünüm: yalnızca kendi çocukları; diğer velilerin ve personelin kişisel verisi yok */
export function veliVerisi(db: Db, veliId: string): Db {
  const cocuklar = db.ogrenciler.filter((o) => o.veliIds.includes(veliId) && o.durum === "aktif");
  const ogrIds = new Set(cocuklar.map((o) => o.id));
  const kayitlar = db.kayitlar.filter((k) => ogrIds.has(k.ogrenciId));
  const grupIds = new Set(kayitlar.map((k) => k.grupId));
  const subeIds = new Set(kayitlar.map((k) => k.subeId));
  const program = db.program.filter((p) => grupIds.has(p.grupId));
  const etut = veliEtutVerisi(db, ogrIds, subeIds);
  const ogretmenIds = new Set([...program.map((p) => p.ogretmenId), ...etut.ogretmenIds, ...db.gruplar.filter((g) => grupIds.has(g.id)).map((g) => g.rehberId)]);
  const v = db.veliler.find((x) => x.id === veliId)!;
  // Kaydı sona eren çocuk: yalnızca adı ve açık taksitleri (ogrIds'e girmez; yoklama, ödev, program gitmez)
  const ayrilan = db.moduller.finans ? ayrilanAcikBorclar(db.ogrenciler, db.taksitler, veliId) : { ogrenciler: [], taksitler: [] };
  const gorunenSubeler = new Set([...subeIds, ...etut.randevular.filter((r) => r.ogrenciIds.length).map((r) => r.subeId)]);
  // İzin listesi: "...db" yok; Db'ye eklenen yeni alan derleme hatası verir, kendiliğinden veliye gitmez
  return {
    surum: db.surum,
    moduller: db.moduller,
    kurum: { ad: db.kurum.ad, eposta: db.kurum.eposta, vergiNo: "", makbuzBasligi: "", logo: db.kurum.logo },
    subeler: db.subeler.filter((s) => gorunenSubeler.has(s.id)).map((s) => ({ ...s, mudur: "" })),
    sezonlar: db.sezonlar,
    dersler: db.dersler,
    derslikler: db.derslikler.filter((x) => gorunenSubeler.has(x.subeId)),
    dersSaatleri: db.dersSaatleri.filter((x) => gorunenSubeler.has(x.subeId)),
    fiyatListesi: [],
    personel: db.personel
      .filter((p) => ogretmenIds.has(p.id))
      .map((p) => ({ id: p.id, ad: p.ad, soyad: p.soyad, gorev: p.gorev, telefon: "", eposta: "", subeIds: [], anaSubeId: "", dersIds: [], baslangic: "", aktif: p.aktif, ucretTipi: "sabit", dersUcreti: 0, sabitUcret: 0 })),
    kullanicilar: [],
    girisler: [],
    rolYetkileri: {} as Db["rolYetkileri"],
    veliler: [v],
    // Diğer velinin kimliği, personel notu ve sağlık notu gitmez
    ogrenciler: [
      ...cocuklar.map(({ iceAktarmaId: _i, ...o }) => ({ ...o, notlar: [], saglikNotu: "", veliIds: [veliId], birincilVeliId: veliId })),
      // cinsiyet türün zorunlu alanı; gerçek değer gönderilmez
      ...ayrilan.ogrenciler.map((o) => ({ id: o.id, ad: o.ad, soyad: "", dogum: "", cinsiyet: "K" as const, okul: "", okulSinifi: "", saglikNotu: "", veliIds: [veliId], birincilVeliId: veliId, durum: o.durum, notlar: [] })),
    ],
    // Sözleşme fiyatı, indirim ve iptal hesabı portalda kullanılmaz (personel adı da içerir)
    kayitlar: kayitlar.map((k) => ({ id: k.id, ogrenciId: k.ogrenciId, sezonId: k.sezonId, subeId: k.subeId, grupId: k.grupId, sozlesmeNo: "", durum: k.durum, tarih: k.tarih, grupGecmisi: [], ekHizmetler: [], kvkkOnay: null, listeFiyati: 0, indirimler: [], net: 0 })),
    gruplar: db.gruplar.filter((g) => grupIds.has(g.id)),
    program,
    yedekAtamalari: [],
    tatiller: db.tatiller.filter((t) => !t.subeId || subeIds.has(t.subeId)),
    iptaller: db.iptaller.filter((i) => program.some((p) => i.oturumId.startsWith(p.id + "_"))),
    yoklamalar: Object.fromEntries(
      Object.values(db.yoklamalar)
        .filter((y) => grupIds.has(y.grupId) && Object.keys(y.durumlar).some((o) => ogrIds.has(o)))
        .map((y) => [y.oturumId, { ...y, durumlar: Object.fromEntries(Object.entries(y.durumlar).filter(([o]) => ogrIds.has(o))) }]),
    ),
    izinler: db.izinler.filter((i) => ogrIds.has(i.ogrenciId)).map((i) => ({ ...i, veliId })),
    adaylar: [],
    odevler: db.moduller?.odev === false ? [] : veliOdevleri(db.odevler, kayitlar, ogrIds),
    // Başka öğrencilerin randevuları ve öğretmenin grup dersleri yalnızca "dolu saat" olarak görünür (Bölüm 09)
    musaitlikler: etut.musaitlikler,
    randevular: etut.randevular,
    paketler: etut.paketler,
    doluSaatler: etut.doluSaatler,
    olaylar: [],
    // Sağlayıcı hatası, maliyet ve alıcı satırı veliye gitmez
    gonderimler: db.gonderimler.filter((g) => g.veliId === veliId && veliGonderimGorunur(g, db.olaylar, db.moduller)).map((g) => ({ ...g, hata: undefined, gonderimBasladi: undefined, deneme: undefined, adayId: undefined, alici: "", maliyet: 0 })),
    duyurular: db.duyurular
      .filter((d) => !d.zamanlanmis && d.aliciVeliIds.includes(veliId))
      .map((d) => ({ ...d, subeIds: undefined, gonderen: "", hedef: { tur: "tum" as const, deger: null }, aliciVeliIds: [veliId], okuyanVeliIds: d.okuyanVeliIds.includes(veliId) ? [veliId] : [] })),
    taksitler: db.moduller.finans
      ? [
          ...db.taksitler.filter((t) => ogrIds.has(t.ogrenciId)).map((t) => ({ ...t, veliId })),
          ...ayrilan.taksitler.map((t) => ({ id: t.id, kayitId: "", ogrenciId: t.ogrenciId, veliId, subeId: "", no: t.no, vade: t.vade, tutar: t.tutar, odenen: t.odenen })),
        ]
      : [],
    tahsilatlar: [],
    giderler: [],
    virmanlar: [],
    iadeler: [],
    islemler: [],
    iceAktarmalar: [],
    kvkk: [],
    avanslar: [],
    hakedisDurum: {},
    ayarlar: { ...db.ayarlar, smsBirimFiyat: 0 },
    otomasyon: {},
  };
}
