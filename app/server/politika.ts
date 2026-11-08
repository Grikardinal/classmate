/**
 * Erişim politikası (Bölüm 02 ve 14): rol + şube kapsamı her istekte SUNUCUDA uygulanır.
 * - okumaSuz(): kullanıcıya yalnızca görebileceği satırlar gider
 * - yazmaDenetle(): her eklenen/değişen/silinen satır için rol, bölüm yetkisi, şube kapsamı ve alan kuralları
 * - veliVerisi(): veli yalnızca kendi çocuklarına ait veriyi görür
 */
import { aktifKayit, taksitKalan, type Aday, type Db, type Ders, type Derslik, type DersSaati, type Grup, type Kayit, type Kullanici, type Kurum, type Ogrenci, type Personel, type ProgramSatiri, type Sezon, type Sube, type Veli } from "../src/data/model";
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
import { telefonNormalize } from "../src/lib/kurallar";
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

export function ogretmenGruplari(db: Db, personelId: string): Set<string> {
  return new Set([
    ...db.program.filter((p) => p.ogretmenId === personelId).map((p) => p.grupId),
    ...db.gruplar.filter((g) => g.rehberId === personelId).map((g) => g.id),
  ]);
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
    case "musaitlikler": case "randevular": case "adaylar": case "gonderimler": case "avanslar": case "tatiller": case "giderler": case "islemler":
      return tek(s.subeId);
    case "program": case "yoklamalar": case "odevler":
      return tek(grupSube(db, s.grupId));
    case "iptaller": {
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
const FINANS: Koleksiyon[] = ["taksitler", "tahsilatlar", "giderler", "virmanlar"];

export function okumaSuz(db: Db, a: Aktor): Db {
  const genel = a.kullanici.rol === "genel-yonetici";
  const ogretmen = a.kullanici.rol === "ogretmen";
  const kap = new Set(kapsam(db, a.kullanici));
  const ogrGrup = ogretmen ? ogretmenGruplari(db, a.personel.id) : null;
  const sonuc = { ...db } as unknown as Record<string, unknown>;

  const gorur = (k: Koleksiyon, s: Satir): boolean => {
    if (FINANS.includes(k) && (!yetki(db, a, "05") || ogretmen)) return false;
    if (k === "girisler") return genel;
    if ((k === "kvkk" || k === "iceAktarmalar") && !yetki(db, a, "14")) return false;
    if (k === "kullanicilar" && !yetki(db, a, "02")) return s.id === a.kullanici.id;
    // Aday kişisel verisi (KVKK): yalnızca ön kayıt (03) veya kesin kayıt (04) yetkisi olan görür
    if (k === "adaylar" && !genel && !yetki(db, a, "03") && !yetki(db, a, "04")) return false;
    // Şube tanımları kişisel veri içermez; nakil / devir hedefi seçilebilsin diye her personel görür (kapsam değişmez)
    if (k === "subeler") return true;
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
      if (k === "gruplar") l = l.filter((s) => ogrGrup.has(String(s.id)));
      if (k === "kayitlar") l = l.filter((s) => ogrGrup.has(String(s.grupId)));
      if (k === "ogrenciler") l = l.filter((s) => ogrIds.has(String(s.id)));
      if (k === "yoklamalar" || k === "odevler" || k === "program") l = l.filter((s) => ogrGrup.has(String(s.grupId)) || s.ogretmenId === a.personel.id);
      if (k === "iptaller") l = l.filter((s) => db.program.some((p) => ogrGrup.has(p.grupId) && String(s.oturumId).startsWith(p.id + "_")));
      if (k === "veliler")
        l = l
          .filter((s) => db.ogrenciler.some((o) => ogrIds.has(o.id) && o.veliIds.includes(String(s.id))))
          .map((s) => ({ ...s, telefon: maskele(String(s.telefon)), eposta: "" }));
      if (k === "adaylar" || k === "duyurular" || k === "gonderimler" || k === "islemler" || k === "kvkk") l = [];
    }
    if (k === "personel" && !genel && !yetki(db, a, "13"))
      l = l.map((s) => (s.id === a.personel.id ? s : { ...s, telefon: "", eposta: "", sabitUcret: 0, dersUcreti: 0 }));
    sonuc[k] = k === "yoklamalar" ? Object.fromEntries(l.map((s) => [s.oturumId, s])) : l;
  }
  // Personel ücret bilgisi yalnızca hak ediş yetkisi olanlara
  if (!yetki(db, a, "13") && !genel) sonuc.hakedisDurum = {};
  return sonuc as unknown as Db;
}

export const maskele = (tel: string) => (tel.length > 4 ? tel.slice(0, 2) + tel.slice(2, -2).replace(/\d/g, "*") + tel.slice(-2) : "***");

/* =========================== Yazma =========================== */
/** Koleksiyon → yazma yetkisi veren bölüm kodları ("*" = her personel) */
const YAZMA: Record<Koleksiyon, string[]> = {
  subeler: ["01"], sezonlar: ["01"], dersler: ["01"], derslikler: ["01"], dersSaatleri: ["01"], gruplar: ["01"],
  personel: ["13", "02"], kullanicilar: ["02", "13"], girisler: [],
  veliler: ["04", "14", "02"], ogrenciler: ["04", "14"], kayitlar: ["04", "14"],
  program: ["06"], tatiller: ["06"], iptaller: ["06"], yoklamalar: ["07"], izinler: ["07"],
  adaylar: ["03", "04", "14"], odevler: ["08"], musaitlikler: ["09"], randevular: ["09"], paketler: ["09", "04"],
  olaylar: ["10"], gonderimler: ["*"], duyurular: ["10"],
  taksitler: ["05", "04", "09"], tahsilatlar: ["05"], giderler: ["05", "13"], virmanlar: ["05"],
  islemler: ["*"], iceAktarmalar: ["14"], kvkk: ["14"], avanslar: ["13"],
};
const TEKIL_YAZMA: Record<Tekil, string[]> = {
  kurum: ["01"], moduller: ["01"], fiyatListesi: ["01"], rolYetkileri: ["02"], ayarlar: ["10", "14"], hakedisDurum: ["13"], otomasyon: [],
};
/** Silinebilen koleksiyonlar (diğerleri yalnızca pasife alınır / iptal edilir) */
const SILINEBILIR = new Set<Koleksiyon>(["musaitlikler", "odevler", "tatiller", "program", "derslikler", "dersSaatleri"]);
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
  const ogrGrup = rol === "ogretmen" ? ogretmenGruplari(onceki, a.personel.id) : null;
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
    // Öğretmen finans verisine ve ücretli paket satışına hiçbir yoldan yazamaz (Bölüm 02)
    if (rol === "ogretmen" && (FINANS.includes(k) || k === "paketler")) hata("Öğretmen finans kayıtlarını değiştiremez.");
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
            if (!(eski.durum === "basarisiz" && s.durum !== "basarisiz" && yetki(onceki, a, "10"))) hata("Gönderim kaydı değiştirilemez.");
            yaz.push({ ...eski, durum: "bekliyor", hata: undefined, zaman });
            continue;
          }
          s.durum = "bekliyor";
          s.zaman = zaman;
          break;
        case "tahsilatlar":
          if (eski) {
            const sadeceIptal = !eski.iptal && s.iptal && JSON.stringify({ ...eski, iptal: null }) === JSON.stringify({ ...s, iptal: null });
            if (!sadeceIptal || !(genel || rol === "sube-muduru")) hata("Tahsilat değiştirilemez; yalnızca yönetici iptal edebilir.");
            s.iptal = { ...(s.iptal as object), kullanici: ad, zaman };
          } else s.kullanici = ad;
          break;
        case "kullanicilar":
          // Ayrıntılı kurallar: kullaniciDenetle() (Bölüm 02). Son giriş zamanını yalnızca sunucu yazar.
          s.eposta = epostaNormalize(s.eposta);
          s.sonGiris = eski ? (eski.sonGiris ?? null) : null;
          break;
        case "yoklamalar":
          if (ogrGrup) {
            if (!ogrGrup.has(String(s.grupId))) hata("Yalnızca kendi gruplarınızın yoklamasını alabilirsiniz.");
            if (eski && eski.tarih !== zaman.slice(0, 10)) hata("Geçmiş günün yoklamasını yalnızca yönetici düzeltebilir.");
          }
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
        case "odevler": case "musaitlikler": case "randevular":
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
  kullaniciDenetle(onceki, sonrakiDb, temiz, a);
  kayitDenetle(onceki, sonrakiDb, temiz, a, zaman);
  onKayitDenetle(onceki, sonrakiDb, temiz, a);
  return temiz;
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
    if (eski && eski.subeId !== k.subeId && !genel && !kap.includes(k.subeId)) {
      reddet(kapsamDisiNakilEngeli(k, eski, son));
      // Kalan taksitler yeni şubeye devredilir (ekran kapsam dışına taksit yazamaz; devri sunucu ekler)
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
  if ("kurum" in tekil) reddet(kurumDogrula(tekil.kurum as Kurum));
  if ("fiyatListesi" in tekil) reddet(fiyatListesiDogrula(tekil.fiyatListesi));
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
  const ogretmenIds = new Set([...program.map((p) => p.ogretmenId), ...db.musaitlikler.map((m) => m.ogretmenId), ...db.gruplar.filter((g) => grupIds.has(g.id)).map((g) => g.rehberId)]);
  const v = db.veliler.find((x) => x.id === veliId)!;
  return {
    ...db,
    kurum: db.kurum,
    personel: db.personel
      .filter((p) => ogretmenIds.has(p.id))
      .map((p) => ({ ...p, telefon: "", eposta: "", ucretTipi: "sabit", dersUcreti: 0, sabitUcret: 0, baslangic: "" })),
    kullanicilar: [],
    girisler: [],
    rolYetkileri: {} as Db["rolYetkileri"],
    veliler: [v],
    ogrenciler: cocuklar.map((o) => ({ ...o, notlar: [] })),
    kayitlar: kayitlar.map((k) => ({ ...k })),
    gruplar: db.gruplar.filter((g) => grupIds.has(g.id)),
    program,
    tatiller: db.tatiller.filter((t) => !t.subeId || subeIds.has(t.subeId)),
    iptaller: db.iptaller.filter((i) => program.some((p) => i.oturumId.startsWith(p.id + "_"))),
    yoklamalar: Object.fromEntries(
      Object.values(db.yoklamalar)
        .filter((y) => grupIds.has(y.grupId))
        .map((y) => [y.oturumId, { ...y, durumlar: Object.fromEntries(Object.entries(y.durumlar).filter(([o]) => ogrIds.has(o))) }]),
    ),
    izinler: db.izinler.filter((i) => ogrIds.has(i.ogrenciId)),
    adaylar: [],
    odevler: db.odevler
      .filter((o) => grupIds.has(o.grupId) && (!o.ogrenciIds || o.ogrenciIds.some((x) => ogrIds.has(x))))
      .map((o) => ({
        ...o,
        teslimler: Object.fromEntries(Object.entries(o.teslimler).filter(([x]) => ogrIds.has(x))),
        notlar: Object.fromEntries(Object.entries(o.notlar).filter(([x]) => ogrIds.has(x))),
        ogrenciIds: o.ogrenciIds ? o.ogrenciIds.filter((x) => ogrIds.has(x)) : null,
      })),
    musaitlikler: db.musaitlikler.filter((m) => subeIds.has(m.subeId)),
    // Başka öğrencilerin randevuları yalnızca "dolu saat" olarak görünür
    randevular: db.randevular
      .filter((r) => subeIds.has(r.subeId))
      .map((r) => (r.ogrenciIds.some((x) => ogrIds.has(x)) ? { ...r, ogrenciIds: r.ogrenciIds.filter((x) => ogrIds.has(x)) } : { ...r, ogrenciIds: [], link: "", paketId: null })),
    paketler: db.paketler.filter((p) => ogrIds.has(p.ogrenciId)),
    olaylar: [],
    gonderimler: db.gonderimler.filter((g) => g.veliId === veliId && g.olay !== "otp"),
    duyurular: db.duyurular
      .filter((d) => !d.zamanlanmis && d.aliciVeliIds.includes(veliId))
      .map((d) => ({ ...d, aliciVeliIds: [veliId], okuyanVeliIds: d.okuyanVeliIds.includes(veliId) ? [veliId] : [] })),
    taksitler: db.moduller.finans ? db.taksitler.filter((t) => ogrIds.has(t.ogrenciId)) : [],
    tahsilatlar: [],
    giderler: [],
    virmanlar: [],
    islemler: [],
    iceAktarmalar: [],
    kvkk: [],
    avanslar: [],
    hakedisDurum: {},
    ayarlar: { ...db.ayarlar, smsBirimFiyat: 0 },
  };
}
