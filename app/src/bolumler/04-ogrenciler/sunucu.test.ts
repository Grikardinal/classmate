/**
 * Bölüm 04'ün sunucu tarafı: server/politika.ts · yazmaDenetle → kayitDenetle (+ onKayitDenetle istisnası) ve okumaSuz.
 * Veritabanı açılmaz: örnek veri + değişiklik paketi (store.guncelle ile aynı fark hesabı).
 */
import { describe, expect, it } from "vitest";
import { ornekVeriUret, type Aday, type Db, type Kayit, type Ogrenci, type Veli } from "@/data/model";
import { farkHesapla, farkUygula, type Degisiklik } from "@/data/fark";
import { YetkiHatasi, okumaSuz, yazmaDenetle, type Aktor } from "../../../server/politika";
import { sezonGecisiPlani } from "../01-kurum-yapisi/kurallar";
import { adayYenidenAc, ogrenciDurumu } from "./kurallar";

const db = ornekVeriUret();
const aktor = (kullaniciId: string, kaynak: Db = db): Aktor => {
  const kullanici = kaynak.kullanicilar.find((k) => k.id === kullaniciId)!;
  return { kullanici, personel: kaynak.personel.find((p) => p.id === kullanici.personelId)! };
};
const YONETICI = aktor("u0");
const GUL = aktor("u9"); // sekreter · s1
const MUDUR_S1 = aktor("u1"); // şube müdürü · s1
const OGRETMEN = aktor("u4");
const ZAMAN = "2026-11-07T10:00";
const BUGUN = ZAMAN.slice(0, 10);

function dene(fn: (x: Db) => void, a: Aktor = GUL, kaynak: Db = db) {
  const taslak = { ...kaynak } as Db;
  for (const k of Object.keys(taslak) as (keyof Db)[]) {
    const v = taslak[k];
    if (Array.isArray(v)) (taslak as Record<string, unknown>)[k] = [...v];
    else if (v && typeof v === "object") (taslak as Record<string, unknown>)[k] = { ...(v as object) };
  }
  fn(taslak);
  const fark: Degisiklik = farkHesapla(kaynak, taslak);
  return () => yazmaDenetle(kaynak, farkUygula(kaynak, fark), fark, a, ZAMAN);
}
const reddedilir = (f: () => unknown, mesaj?: RegExp) => {
  expect(f).toThrow(YetkiHatasi);
  if (mesaj) expect(f).toThrow(mesaj);
};
const yaz = <T>(t: Degisiklik, k: keyof Degisiklik["koleksiyonlar"]) => (t.koleksiyonlar[k]?.yaz ?? []) as unknown as T[];

const k4 = db.kayitlar.find((k) => k.id === "k4")!; // o3 · s1 · g1
const s2Kayit = db.kayitlar.find((k) => k.subeId === "s2")!;
const s2Veli = db.veliler.find((v) => v.id === db.ogrenciler.find((o) => o.id === s2Kayit.ogrenciId)!.birincilVeliId)!;
const s2Ogr = db.ogrenciler.find((o) => o.id === s2Kayit.ogrenciId)!;

/** Kayıt sihirbazının paketi: yeni veli + öğrenci + kayıt */
const sihirbaz = (p: { veli?: Partial<Veli>; ogr?: Partial<Ogrenci>; kayit?: Partial<Kayit>; veliId?: string } = {}) => (x: Db) => {
  const veliId = p.veliId ?? "v-yeni";
  if (!p.veliId)
    x.veliler.push({ id: veliId, ad: " Seda ", soyad: "Kaya", telefon: "+90 532 111 22 33", eposta: "", yakinlik: "Anne", pushAcik: false, portalDavet: "gonderildi", izinSms: true, izinTanitim: false, ...p.veli });
  x.ogrenciler.push({ id: "o-yeni", ad: "Ecrin", soyad: "Kaya", dogum: "2015-05-05", cinsiyet: "K", okul: "", okulSinifi: "", saglikNotu: "", veliIds: [veliId], birincilVeliId: veliId, durum: "aktif", notlar: [], ...p.ogr });
  x.kayitlar.push({
    id: "k-yeni", ogrenciId: "o-yeni", sezonId: "z2", subeId: "s1", grupId: "g1", sozlesmeNo: "MRK-2026-0900", durum: "aktif", tarih: BUGUN,
    grupGecmisi: [{ grupId: p.kayit?.grupId ?? "g1", tarih: BUGUN }], ekHizmetler: [], kvkkOnay: { tarih: BUGUN, surum: "v1.2" }, listeFiyati: 0, indirimler: [], net: 0, ...p.kayit,
  });
};
const kayitDegistir = (id: string, p: Partial<Kayit>) => (x: Db) => void (x.kayitlar = x.kayitlar.map((k) => (k.id === id ? { ...k, ...p } : k)));

describe("yeni kayıt (sihirbaz paketi)", () => {
  it("kabul edilir; veli telefonu tek biçime, adlar temizlenir", () => {
    const t = dene(sihirbaz())();
    expect(yaz<Veli>(t, "veliler")[0]).toMatchObject({ telefon: "0532 111 22 33", ad: "Seda" });
    expect(yaz<Kayit>(t, "kayitlar")[0].sozlesmeNo).toBe("MRK-2026-0900");
  });
  it("geçersiz telefon, gelecekteki doğum tarihi, velisiz öğrenci reddedilir", () => {
    reddedilir(dene(sihirbaz({ veli: { telefon: "12345" } })), /telefon/);
    reddedilir(dene(sihirbaz({ ogr: { dogum: "2030-01-01" } })), /Doğum/);
    reddedilir(dene(sihirbaz({ ogr: { veliIds: [], birincilVeliId: "" } })), /veli/);
  });
  it("kayıtsız öğrenci kartı oluşturulamaz", () => {
    reddedilir(dene((x) => void x.ogrenciler.push({ ...db.ogrenciler[0], id: "o-tek", ad: "Tek", soyad: "Başına" }), YONETICI), /kayıtla birlikte/);
  });
  it("pasif şubeye, başka şubenin grubuna, aktif olmayan sezona kayıt reddedilir", () => {
    reddedilir(dene(sihirbaz({ kayit: { subeId: "s3", sozlesmeNo: "SHL-2026-0001" } }), YONETICI), /Pasif/);
    reddedilir(dene(sihirbaz({ kayit: { grupId: "g5" } })), /şubesine/);
    reddedilir(dene(sihirbaz({ kayit: { sezonId: "z1" } })), /sezonuna/);
  });
  it("dolu gruba sekreter de, şube müdürü de kapasite aşımıyla kayıt yapabilir (karar 2026-11-07)", () => {
    expect(dene(sihirbaz({ kayit: { grupId: "g2" } }), GUL)).not.toThrow();
    expect(dene(sihirbaz({ kayit: { grupId: "g2" } }), MUDUR_S1)).not.toThrow();
  });
  it("başka şubeye kayıt yazma kapsam dışıdır", () => {
    reddedilir(dene(sihirbaz({ kayit: { subeId: "s2", grupId: "g5", sozlesmeNo: "KZY-2026-0900" } }), GUL), /kapsam/);
  });
  it("öğretmen öğrenci/kayıt yazamaz", () => {
    reddedilir(dene(sihirbaz(), OGRETMEN), /yetkiniz yok/);
  });
});

describe("mükerrer öğrenci ve veli eşleştirme (kurum geneli)", () => {
  it("başka şubedeki aynı ad + veli telefonlu öğrenci (ekranın göremediği) reddedilir", () => {
    expect(okumaSuz(db, GUL).ogrenciler.some((o) => o.id === s2Ogr.id)).toBe(false);
    reddedilir(
      dene(sihirbaz({ veli: { telefon: s2Veli.telefon.replace(/\s/g, "") }, ogr: { ad: s2Ogr.ad.toLocaleUpperCase("tr-TR"), soyad: s2Ogr.soyad } })),
      /kayıtlı bir öğrenci var/,
    );
  });
  it("yeni velinin telefonu başka şubedeki veliye aitse yeni veli yazılmaz, öğrenci mevcut veliye bağlanır", () => {
    const t = dene(sihirbaz({ veli: { telefon: s2Veli.telefon } }))();
    expect(yaz<Veli>(t, "veliler")).toHaveLength(0);
    const o = yaz<Ogrenci>(t, "ogrenciler")[0];
    expect(o.veliIds).toEqual([s2Veli.id]);
    expect(o.birincilVeliId).toBe(s2Veli.id);
  });
  it("var olan velinin telefonu başka veliye ait numaraya çevrilemez", () => {
    const v = db.veliler.find((x) => x.id === "v1")!;
    reddedilir(dene((x) => void (x.veliler = x.veliler.map((y) => (y.id === "v2" ? { ...y, telefon: v.telefon } : y))), YONETICI), /başka bir veliye/);
  });
});

describe("sözleşme numarası", () => {
  it("çakışan numara (ekranın görmediği nakledilmiş kayıt) sunucuda sıradaki numarayla değiştirilir", () => {
    const t = dene(sihirbaz({ kayit: { sozlesmeNo: k4.sozlesmeNo } }))();
    const no = yaz<Kayit>(t, "kayitlar")[0].sozlesmeNo;
    expect(no).not.toBe(k4.sozlesmeNo);
    expect(no).toMatch(/^MRK-2026-\d{4}$/);
    expect(db.kayitlar.some((k) => k.sozlesmeNo === no)).toBe(false);
  });
  it("şube koduyla başlamayan numara reddedilir; var olan kaydın numarası değiştirilemez", () => {
    reddedilir(dene(sihirbaz({ kayit: { sozlesmeNo: "KZY-2026-0900" } })), /MRK-/);
    reddedilir(dene(kayitDegistir("k4", { sozlesmeNo: "MRK-2026-5555" })), /sözleşme numarası/);
  });
});

describe("kayıt durumu, grup değişikliği ve nakil", () => {
  it("dondurma ve aktifleştirme serbest; iptal geri alınamaz", () => {
    expect(dene(kayitDegistir("k4", { durum: "dondurulmus" }))).not.toThrow();
    const v = structuredClone(db);
    v.kayitlar = v.kayitlar.map((k) => (k.id === "k4" ? { ...k, durum: "iptal" } : k));
    v.ogrenciler = v.ogrenciler.map((o) => (o.id === "o3" ? { ...o, durum: "ayrildi" } : o));
    reddedilir(dene(kayitDegistir("k4", { durum: "aktif" }), YONETICI, v), /geri alınamaz/);
    reddedilir(dene((x) => void (x.ogrenciler = x.ogrenciler.map((o) => (o.id === "o3" ? { ...o, durum: "aktif" } : o))), YONETICI, v), /yalnızca yeni bir kayıtla/);
  });
  it("iptalde öğrenci 'ayrıldı' olmalı; iptal olmayan kaydı varken öğrenci ayrılamaz", () => {
    reddedilir(dene(kayitDegistir("k4", { durum: "iptal" })), /ayrıldı/);
    reddedilir(dene((x) => void (x.ogrenciler = x.ogrenciler.map((o) => (o.id === "o3" ? { ...o, durum: "ayrildi" } : o)))), /Süren kaydı/);
  });
  it("grup değişikliği grup geçmişine eklenmeli; dolu gruba sekreter onayla geçirebilir", () => {
    reddedilir(dene(kayitDegistir("k4", { grupId: "g3" })), /grup geçmişine/);
    expect(dene(kayitDegistir("k4", { grupId: "g3", grupGecmisi: [...k4.grupGecmisi, { grupId: "g3", tarih: BUGUN }] }))).not.toThrow();
    expect(dene(kayitDegistir("k4", { grupId: "g2", grupGecmisi: [...k4.grupGecmisi, { grupId: "g2", tarih: BUGUN }] }))).not.toThrow();
  });
  it("nakil: eski hal kapsamda olmalı; grup yeni şubeye ait olmalı", () => {
    const nakil = { subeId: "s2", grupId: "g5", grupGecmisi: [...k4.grupGecmisi, { grupId: "g5", tarih: BUGUN }] };
    reddedilir(dene(kayitDegistir("k4", nakil), GUL), /boş kontenjanlı grup yok/); // kapsam dışı: s2de 3. sınıf grubu yok
    reddedilir(dene(kayitDegistir(s2Kayit.id, { subeId: "s1", grupId: "g1", grupGecmisi: [...s2Kayit.grupGecmisi, { grupId: "g1", tarih: BUGUN }] }), GUL), /kapsam/);
    expect(dene(kayitDegistir("k4", nakil), aktor("u10"))).not.toThrow(); // s1 + s2 sekreteri
    reddedilir(dene(kayitDegistir("k4", { ...nakil, grupId: "g1" }), YONETICI), /şubesine/);
  });
});

describe("öğrenci kartı ve notlar", () => {
  it("not silinemez; yeni notun yazarı ve zamanı sunucudan", () => {
    const t = dene((x) => void (x.ogrenciler = x.ogrenciler.map((o) => (o.id === "o3" ? { ...o, notlar: [{ tarih: "2000-01-01T00:00", yazar: "Sahte", metin: "Veli aradı" }, ...o.notlar] } : o))))();
    expect(yaz<Ogrenci>(t, "ogrenciler")[0].notlar[0]).toEqual({ tarih: ZAMAN, yazar: "Gül Koç", metin: "Veli aradı" });
    const v = structuredClone(db);
    v.ogrenciler = v.ogrenciler.map((o) => (o.id === "o3" ? { ...o, notlar: [{ tarih: ZAMAN, yazar: "Gül Koç", metin: "Eski" }] } : o));
    reddedilir(dene((x) => void (x.ogrenciler = x.ogrenciler.map((o) => (o.id === "o3" ? { ...o, notlar: [] } : o))), GUL, v), /Notlar silinemez/);
  });
  it("kaydı olmayan öğrenci kurum geneli sayılmaz: yalnızca genel yönetici görür", () => {
    const v = structuredClone(db);
    v.ogrenciler.push({ ...db.ogrenciler[0], id: "o-kayitsiz" });
    expect(okumaSuz(v, aktor("u9", v)).ogrenciler.some((o) => o.id === "o-kayitsiz")).toBe(false);
    expect(okumaSuz(v, aktor("u0", v)).ogrenciler.some((o) => o.id === "o-kayitsiz")).toBe(true);
  });
  it("KVKK anonimleştirmesi (Bölüm 14 paketi) yalnızca 14 yetkisiyle", () => {
    const anonim = (x: Db) => {
      x.ogrenciler = x.ogrenciler.map((o) => (o.id === "o3" ? { ...o, ad: "E***", soyad: "Y***", dogum: "", okul: "", saglikNotu: "", notlar: [], durum: "ayrildi" } : o));
      x.kayitlar = x.kayitlar.map((k) => (k.ogrenciId === "o3" && k.durum !== "iptal" ? { ...k, durum: "iptal" } : k));
    };
    reddedilir(dene(anonim, GUL), /KVKK/);
    const t = dene(anonim, YONETICI)();
    expect(t.koleksiyonlar.adaylar).toBeUndefined(); // anonim öğrencinin adayı takibe açılmaz
  });
});

describe("Excel içe aktarma paketi (Bölüm 14)", () => {
  it("içe aktarılan öğrenci + veli + kayıt kabul edilir; dosyadaki mükerrer satır reddedilir", () => {
    const ice = (ikinci: boolean) => (x: Db) => {
      x.veliler.push({ id: "v-ia", ad: "Veli", soyad: "Ak", telefon: "0533 444 55 66", eposta: "", yakinlik: "Diğer", pushAcik: false, portalDavet: "bekliyor", izinSms: true, izinTanitim: false });
      for (const [i, n] of (ikinci ? [1, 2] : [1]).entries()) {
        x.ogrenciler.push({ id: `o-ia${n}`, ad: "Mert", soyad: "Ak", dogum: "", cinsiyet: "K", okul: "", okulSinifi: "", saglikNotu: "", veliIds: ["v-ia"], birincilVeliId: "v-ia", durum: "aktif", notlar: [], iceAktarmaId: "ia1" });
        x.kayitlar.push({ id: `k-ia${n}`, ogrenciId: `o-ia${n}`, sezonId: "z2", subeId: "s1", grupId: "g1", sozlesmeNo: `MRK-2026-08${i}0`, durum: "aktif", tarih: BUGUN, grupGecmisi: [{ grupId: "g1", tarih: BUGUN }], ekHizmetler: [], kvkkOnay: null, listeFiyati: 0, indirimler: [], net: 0, iceAktarmaId: "ia1" });
      }
    };
    expect(dene(ice(false), YONETICI)).not.toThrow();
    reddedilir(dene(ice(true), YONETICI), /kayıtlı bir öğrenci var/);
  });
});

describe("kayıt iptali → aday yeniden açılır (karar 2026-11-07)", () => {
  const kayitliAday = db.adaylar.find((a) => a.durum === "kayit" && a.subeId === "s1")!;
  const s2Aday = db.adaylar.find((a) => a.durum === "kayit" && a.subeId === "s2")!;
  const bagla = (adayId: string) => {
    const v = structuredClone(db);
    v.adaylar = v.adaylar.map((a) => (a.id === adayId ? { ...a, ogrenciId: "o3" } : a));
    return v;
  };
  const iptal = (aday?: (x: Db) => void) => (x: Db) => {
    x.kayitlar = x.kayitlar.map((k) => (k.id === "k4" ? { ...k, durum: "iptal" } : k));
    x.ogrenciler = x.ogrenciler.map((o) => (o.id === "o3" ? { ...o, durum: "ayrildi" } : o));
    aday?.(x);
  };
  const ac = (id: string, p: Partial<Aday> = {}) => (x: Db) =>
    void (x.adaylar = x.adaylar.map((a) => (a.id === id ? { ...adayYenidenAc(a, { tarih: ZAMAN, yazar: "Gül Koç", metin: "İptal" }, BUGUN), ...p } : a)));

  it("ekran adayı göndermese de sunucu aynı pakette adayı “Görüşüldü” durumuna açar", () => {
    const v = bagla(kayitliAday.id);
    const t = dene(iptal(), GUL, v)();
    const [a] = yaz<Aday>(t, "adaylar");
    expect(a).toMatchObject({ id: kayitliAday.id, durum: "gorusuldu", sonrakiAksiyon: BUGUN });
    expect(a.ogrenciId).toBeUndefined();
    expect(a.notlar.at(-1)).toMatchObject({ yazar: "Gül Koç", tarih: ZAMAN });
  });
  it("ekranın gönderdiği yeniden açma kabul edilir; başka alan değişirse reddedilir", () => {
    const v = bagla(kayitliAday.id);
    expect(dene(iptal(ac(kayitliAday.id)), GUL, v)).not.toThrow();
    reddedilir(dene(iptal(ac(kayitliAday.id, { veliAd: "Başka Veli" })), GUL, v), /diğer bilgileri/);
    reddedilir(dene(iptal(ac(kayitliAday.id, { durum: "dusunuyor" })), GUL, v), /Görüşüldü/);
  });
  it("kayıt iptali olmadan kayda dönüşmüş aday geri alınamaz (Bölüm 03 kuralı aynen)", () => {
    const v = bagla(kayitliAday.id);
    reddedilir(dene(ac(kayitliAday.id), YONETICI, v), /geri alınamaz/);
    reddedilir(dene((x) => { kayitDegistir("k4", { durum: "dondurulmus" })(x); ac(kayitliAday.id)(x); }, YONETICI, v), /geri alınamaz/);
  });
  it("ön kayıt modülü kapalı veya 03 yetkisi yokken de iptal adayı açar", () => {
    const v = bagla(kayitliAday.id);
    v.moduller.onKayit = false;
    v.rolYetkileri.sekreter["03"] = false;
    const t = dene(iptal(ac(kayitliAday.id)), aktor("u9", v), v)();
    expect(yaz<Aday>(t, "adaylar")[0].durum).toBe("gorusuldu");
  });
  it("aday başka şubedeyse (öğrenci nakledilmiş) iptal eden göremese de sunucu açar", () => {
    const v = bagla(s2Aday.id);
    expect(okumaSuz(v, aktor("u9", v)).adaylar.some((a) => a.id === s2Aday.id)).toBe(false);
    const t = dene(iptal(), aktor("u9", v), v)();
    expect(yaz<Aday>(t, "adaylar")[0]).toMatchObject({ id: s2Aday.id, subeId: "s2", durum: "gorusuldu" });
  });
  it("öğrencinin iptal olmayan başka kaydı sürüyorsa aday açılmaz", () => {
    const v = bagla(kayitliAday.id);
    v.gruplar.push({ ...v.gruplar.find((g) => g.id === "g1")!, id: "g-z3", sezonId: "z3" });
    v.kayitlar.push({ ...k4, id: "k-z3", sezonId: "z3", grupId: "g-z3", sozlesmeNo: "MRK-2027-0001", grupGecmisi: [{ grupId: "g-z3", tarih: BUGUN }] });
    const t = dene(kayitDegistir("k4", { durum: "iptal" }), YONETICI, v)();
    expect(t.koleksiyonlar.adaylar).toBeUndefined();
  });
});

describe("ek kararlar (2026-11-07)", () => {
  const iptalli = () => {
    const v = structuredClone(db);
    v.kayitlar = v.kayitlar.map((k) => (k.id === "k4" ? { ...k, durum: "iptal" } : k));
    v.ogrenciler = v.ogrenciler.map((o) => (o.id === "o3" ? { ...o, durum: "ayrildi" } : o));
    return v;
  };
  const yenidenKayit = (p: Partial<Kayit> = {}, ogrAktif = true) => (x: Db) => {
    if (ogrAktif) x.ogrenciler = x.ogrenciler.map((o) => (o.id === "o3" ? { ...o, durum: "aktif" } : o));
    x.kayitlar.push({ ...k4, id: "k-geri", sozlesmeNo: "MRK-2026-0950", tarih: BUGUN, durum: "aktif", grupGecmisi: [{ grupId: "g1", tarih: BUGUN }], kvkkOnay: { tarih: BUGUN, surum: "v1.2" }, ...p });
  };
  it("iptal sonrası geri dönen öğrenci: mevcut karta yeni kayıt açılır, öğrenci yeniden aktif olur", () => {
    const v = iptalli();
    const t = dene(yenidenKayit(), aktor("u9", v), v)();
    expect(yaz<Ogrenci>(t, "ogrenciler")[0]).toMatchObject({ id: "o3", durum: "aktif" });
    reddedilir(dene(yenidenKayit({}, false), aktor("u9", v), v), /“aktif” durumuna/); // kart aktifleşmeden
    reddedilir(dene(yenidenKayit(), GUL), /zaten bir kaydı/); // süren kaydı varken aynı sezona ikinci kayıt
  });
  it("sekreter kapasite aşımını onaylayabilir; öğretmen hiçbir yoldan kayıt yazamaz", () => {
    expect(dene(kayitDegistir("k4", { grupId: "g2", grupGecmisi: [...k4.grupGecmisi, { grupId: "g2", tarih: BUGUN }] }), GUL)).not.toThrow();
    reddedilir(dene(kayitDegistir("k4", { durum: "dondurulmus" }), OGRETMEN), /yetkiniz yok/);
  });
  it("şube tanımları her personele görünür (nakil hedefi seçilebilsin); kapsam değişmez", () => {
    expect(okumaSuz(db, GUL).subeler).toHaveLength(db.subeler.length);
    expect(okumaSuz(db, GUL).gruplar.every((g) => g.subeId === "s1")).toBe(true);
  });

  describe("kapsam dışındaki aktif şubeye nakil", () => {
    // k4'ü 7. sınıf grubuna alalım: s2'de 7. sınıf grubu g6 var (7/12)
    const hazir = () => {
      const v = structuredClone(db);
      v.gruplar.push({ ...v.gruplar.find((g) => g.id === "g1")!, id: "g-s1-7", seviye: 7, ad: "7-X" });
      v.kayitlar = v.kayitlar.map((k) => (k.id === "k4" ? { ...k, grupId: "g-s1-7", grupGecmisi: [{ grupId: "g-s1-7", tarih: "2026-09-05" }] } : k));
      v.taksitler.push({ id: "tk-nakil", kayitId: "k4", ogrenciId: "o3", veliId: "v1", subeId: "s1", no: 1, vade: "2026-12-05", tutar: 1000, odenen: 0 });
      return v;
    };
    const nakil = (p: Partial<Kayit> = {}, ek?: (x: Db) => void) => (x: Db) => {
      x.kayitlar = x.kayitlar.map((k) => (k.id === "k4" ? { ...k, subeId: "s2", grupId: "", grupGecmisi: [...k.grupGecmisi, { grupId: "", tarih: BUGUN }], ...p } : k));
      ek?.(x);
    };
    const islem = (subeId: string) => (x: Db) => void x.islemler.unshift({ id: "is-nakil", zaman: ZAMAN, kullanici: "", islem: "Şube nakli", detay: "", subeId });
    it("tek şubeye yetkili sekreter nakleder; grup, geçmiş ve taksit devri sunucuda; öğrenci kapsamından çıkar", () => {
      const v = hazir();
      const t = dene(nakil({}, islem("s1")), aktor("u9", v), v)();
      const [k] = yaz<Kayit>(t, "kayitlar");
      expect(k).toMatchObject({ subeId: "s2", grupId: "g6" });
      expect(k.grupGecmisi.at(-1)).toEqual({ grupId: "g6", tarih: BUGUN });
      expect(yaz<{ id: string; subeId: string }>(t, "taksitler")).toContainEqual(expect.objectContaining({ id: "tk-nakil", subeId: "s2" }));
      const sonra = farkUygula(v, t);
      expect(okumaSuz(sonra, aktor("u9", sonra)).ogrenciler.some((o) => o.id === "o3")).toBe(false);
      expect(okumaSuz(sonra, aktor("u2", sonra)).ogrenciler.some((o) => o.id === "o3")).toBe(true);
    });
    it("istisna yalnızca kayıt satırı içindir: işlem kaydı / taksit hedef şubeye yazılamaz", () => {
      const v = hazir();
      reddedilir(dene(nakil({}, islem("s2")), aktor("u9", v), v), /kapsam/);
      reddedilir(dene(nakil({}, (x) => void (x.taksitler = x.taksitler.map((t) => (t.id === "tk-nakil" ? { ...t, subeId: "s2" } : t)))), aktor("u9", v), v), /kapsam/);
    });
    it("başka alan değişemez; pasif şube, dolu hedef, kapsam dışı eski hal reddedilir", () => {
      const v = hazir();
      reddedilir(dene(nakil({ ekHizmetler: ["Yaz okulu"] }), aktor("u9", v), v), /diğer bilgileri/);
      reddedilir(dene(nakil({ subeId: "s3" }), aktor("u9", v), v), /Pasif/);
      const dolu = hazir();
      dolu.gruplar = dolu.gruplar.map((g) => (g.id === "g6" ? { ...g, kapasite: 7 } : g));
      reddedilir(dene(nakil(), aktor("u9", dolu), dolu), /boş kontenjanlı/);
      reddedilir(dene(kayitDegistir(s2Kayit.id, { subeId: "s1" }), GUL), /kapsam/);
    });
  });

  describe("sezon geçişinde mezuniyet", () => {
    it("Bölüm 01 sezon geçişi paketi: 8. sınıf kaydı ve öğrencisi mezun olur, diğerleri yeni sezona taşınır", () => {
      const g4 = db.kayitlar.filter((k) => k.grupId === "g4");
      const t = dene((x) => {
        const plan = sezonGecisiPlani(x, "z2", "z3", true, (p) => `${p}-gecis-${Math.random().toString(36).slice(2, 8)}`);
        x.gruplar.push(...plan.gruplar);
        x.kayitlar.push(...plan.kayitlar);
        const mezun = new Map(plan.mezunlar.map((k) => [k.id, k]));
        x.kayitlar = x.kayitlar.map((k) => mezun.get(k.id) ?? k);
        const ids = new Set(plan.mezunlar.map((k) => k.ogrenciId));
        x.ogrenciler = x.ogrenciler.map((o) => (ids.has(o.id) ? { ...o, durum: ogrenciDurumu(o.id, x.kayitlar) } : o));
      }, YONETICI)();
      const mezunlar = yaz<Kayit>(t, "kayitlar").filter((k) => k.durum === "mezun");
      expect(mezunlar.map((k) => k.id).sort()).toEqual(g4.map((k) => k.id).sort());
      expect(yaz<Ogrenci>(t, "ogrenciler").every((o) => o.durum === "mezun")).toBe(true);
    });
    it("mezuniyeti yalnızca genel yönetici işaretler; öğrenci durumu uyumlu olmalı; mezun geri alınamaz", () => {
      const g4 = db.kayitlar.find((k) => k.grupId === "g4")!;
      const mezunEt = (ogr: boolean) => (x: Db) => {
        kayitDegistir(g4.id, { durum: "mezun" })(x);
        if (ogr) x.ogrenciler = x.ogrenciler.map((o) => (o.id === g4.ogrenciId ? { ...o, durum: "mezun" } : o));
      };
      expect(dene(mezunEt(true), YONETICI)).not.toThrow();
      reddedilir(dene(mezunEt(true), MUDUR_S1), /genel yönetici/);
      reddedilir(dene(mezunEt(false), YONETICI), /mezun/);
      const v = structuredClone(db);
      mezunEt(true)(v);
      reddedilir(dene(kayitDegistir(g4.id, { durum: "aktif" }), YONETICI, v), /geri alınamaz/);
    });
  });
});
