/**
 * Bölüm 04'ün sunucu tarafı: server/politika.ts · yazmaDenetle → kayitDenetle (+ onKayitDenetle istisnası) ve okumaSuz.
 * Veritabanı açılmaz: örnek veri + değişiklik paketi (store.guncelle ile aynı fark hesabı).
 */
import { describe, expect, it } from "vitest";
import { ornekVeriUret, type Aday, type Db, type Kayit, type Ogrenci, type Veli } from "@/data/model";
import { farkHesapla, farkUygula, type Degisiklik } from "@/data/fark";
import { YetkiHatasi, okumaSuz, yazmaDenetle, type Aktor } from "../../../server/politika";
import { adayYenidenAc } from "./kurallar";

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
  it("dolu gruba sekreter kayıt yapamaz; şube müdürü onaylayabilir", () => {
    reddedilir(dene(sihirbaz({ kayit: { grupId: "g2" } }), GUL), /kontenjanı dolu/);
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
    reddedilir(dene((x) => void (x.ogrenciler = x.ogrenciler.map((o) => (o.id === "o3" ? { ...o, durum: "aktif" } : o))), YONETICI, v), /yeniden aktifleştirilemez/);
  });
  it("iptalde öğrenci 'ayrıldı' olmalı; iptal olmayan kaydı varken öğrenci ayrılamaz", () => {
    reddedilir(dene(kayitDegistir("k4", { durum: "iptal" })), /ayrıldı/);
    reddedilir(dene((x) => void (x.ogrenciler = x.ogrenciler.map((o) => (o.id === "o3" ? { ...o, durum: "ayrildi" } : o)))), /İptal edilmemiş/);
  });
  it("grup değişikliği grup geçmişine eklenmeli; dolu gruba sekreter geçiremez", () => {
    reddedilir(dene(kayitDegistir("k4", { grupId: "g3" })), /grup geçmişine/);
    expect(dene(kayitDegistir("k4", { grupId: "g3", grupGecmisi: [...k4.grupGecmisi, { grupId: "g3", tarih: BUGUN }] }))).not.toThrow();
    reddedilir(dene(kayitDegistir("k4", { grupId: "g2", grupGecmisi: [...k4.grupGecmisi, { grupId: "g2", tarih: BUGUN }] })), /kontenjanı dolu/);
  });
  it("nakil iki şubede de yetki ister; grup yeni şubeye ait olmalı", () => {
    const nakil = { subeId: "s2", grupId: "g5", grupGecmisi: [...k4.grupGecmisi, { grupId: "g5", tarih: BUGUN }] };
    reddedilir(dene(kayitDegistir("k4", nakil), GUL), /kapsam/);
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
