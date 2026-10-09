/**
 * Erişim politikası (Bölüm 02 ve 14): rol + şube kapsamı her istekte SUNUCUDA uygulanır.
 * - okumaSuz(): kullanıcıya yalnızca görebileceği satırlar gider
 * - yazmaDenetle(): her eklenen/değişen/silinen satır için rol, bölüm yetkisi, şube kapsamı ve alan kuralları
 * - veliVerisi(): veli yalnızca kendi çocuklarına ait veriyi görür
 */
import { aktifKayit, type Db, type Kullanici, type Personel } from "../src/data/model";
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

const yetki = (db: Db, a: Aktor, kod: string) => db.rolYetkileri[a.kullanici.rol]?.[kod] === true;
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
      return tek(ogrenciSube(db, s.id));
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
  adaylar: ["03", "04"], odevler: ["08"], musaitlikler: ["09"], randevular: ["09"], paketler: ["09", "04"],
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
      if (!kapsamda(satirSubeleri(sonrakiDb, k, s), k)) hata("Kayıt şube kapsamınız dışında.");

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
          if (s.rol === "genel-yonetici" && !genel) hata("Genel yönetici yetkisi veremezsiniz.");
          if (eski && eski.id === a.kullanici.id && (s.rol !== eski.rol || s.aktif === false)) hata("Kendi rolünüzü değiştiremez veya hesabınızı kapatamazsınız.");
          break;
        case "yoklamalar":
          if (ogrGrup) {
            if (!ogrGrup.has(String(s.grupId))) hata("Yalnızca kendi gruplarınızın yoklamasını alabilirsiniz.");
            if (eski && eski.tarih !== zaman.slice(0, 10)) hata("Geçmiş günün yoklamasını yalnızca yönetici düzeltebilir.");
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
  return temiz;
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
