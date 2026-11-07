/**
 * Bölüm 01 tanımlarının sunucu tarafı denetimi (server/politika.ts · yazmaDenetle → tanimDenetle).
 * Veritabanı açmadan, örnek veri üzerinde istemcinin göndereceği değişiklik paketleriyle sınanır.
 */
import { describe, expect, it } from "vitest";
import { ornekVeriUret, type Db } from "@/data/model";
import { farkHesapla, farkUygula, type Degisiklik } from "@/data/fark";
import { YetkiHatasi, yazmaDenetle, type Aktor } from "../../../server/politika";

const db = ornekVeriUret();
const aktor = (kullaniciId: string): Aktor => {
  const kullanici = db.kullanicilar.find((k) => k.id === kullaniciId)!;
  return { kullanici, personel: db.personel.find((p) => p.id === kullanici.personelId)! };
};
const YONETICI = aktor("u0");
const MUDUR_MERKEZ = aktor("u1"); // Elif · yalnızca s1

/** guncelle() benzeri: taslak üzerinde değişiklik → fark → sunucu denetimi */
function dene(fn: (x: Db) => void, a: Aktor = YONETICI, kaynak: Db = db) {
  // store.guncelle ile aynı: koleksiyonlar sığ kopyalanır, değişmeyen satırlar aynı nesne kalır
  const taslak = { ...kaynak } as Db;
  for (const k of Object.keys(taslak) as (keyof Db)[]) {
    const v = taslak[k];
    if (Array.isArray(v)) (taslak as Record<string, unknown>)[k] = [...v];
    else if (v && typeof v === "object") (taslak as Record<string, unknown>)[k] = { ...(v as object) };
  }
  fn(taslak);
  const fark: Degisiklik = farkHesapla(kaynak, taslak);
  return () => yazmaDenetle(kaynak, farkUygula(kaynak, fark), fark, a, "2026-11-07T10:00");
}
const reddedilir = (f: () => unknown, mesaj?: RegExp) => {
  expect(f).toThrow(YetkiHatasi);
  if (mesaj) expect(f).toThrow(mesaj);
};

describe("şube ve sezon (kurum geneli)", () => {
  it("yinelenen şube kodu veya adı reddedilir", () => {
    reddedilir(dene((x) => x.subeler.push({ id: "s9", ad: "Batı", kod: "MRK", adres: "", telefon: "", mudur: "", aktif: true })), /kod/);
    reddedilir(dene((x) => x.subeler.push({ id: "s9", ad: "merkez", kod: "BTI", adres: "", telefon: "", mudur: "", aktif: true })), /zaten/);
    expect(dene((x) => x.subeler.push({ id: "s9", ad: "Batı", kod: "BTI", adres: "", telefon: "", mudur: "", aktif: true }))).not.toThrow();
  });
  it("aktif öğrencisi olan şube pasife alınamaz", () => {
    reddedilir(dene((x) => (x.subeler = x.subeler.map((s) => (s.id === "s1" ? { ...s, aktif: false } : s)))), /nakledin/);
  });
  it("şube müdürü (01 yetkisi verilse bile) şube/sezon tanımlayamaz", () => {
    const yetkili = structuredClone(db);
    yetkili.rolYetkileri["sube-muduru"]["01"] = true;
    reddedilir(dene((x) => (x.subeler[0] = { ...x.subeler[0], telefon: "1" }), MUDUR_MERKEZ, yetkili), /genel yönetici/);
  });
  it("iki aktif sezon veya aktif sezonsuz durum reddedilir", () => {
    reddedilir(dene((x) => (x.sezonlar = x.sezonlar.map((s) => ({ ...s, aktif: true })))), /yalnızca bir/);
    reddedilir(dene((x) => (x.sezonlar = x.sezonlar.map((s) => ({ ...s, aktif: false })))), /aktif sezon/);
    expect(dene((x) => (x.sezonlar = x.sezonlar.map((s) => ({ ...s, aktif: s.id === "z3" }))))).not.toThrow();
  });
  it("bitişi başlangıçtan önce olan veya yinelenen sezon reddedilir", () => {
    reddedilir(dene((x) => x.sezonlar.push({ id: "z9", ad: "2027-2028", baslangic: "2028-06-01", bitis: "2027-09-01", aktif: false })), /Bitiş/);
    reddedilir(dene((x) => x.sezonlar.push({ id: "z9", ad: "2026-2027", baslangic: "2027-09-01", bitis: "2028-06-01", aktif: false })), /zaten/);
  });
  it("bozuk kurum bilgisi, negatif fiyat ve modül ayarı reddedilir", () => {
    reddedilir(dene((x) => (x.kurum = { ...x.kurum, ad: "" })), /Kurum adı/);
    reddedilir(dene((x) => (x.fiyatListesi = { ...x.fiyatListesi, s1: -5 })), /fiyat/i);
    reddedilir(dene((x) => (x.moduller = { ...x.moduller, finans: "evet" as unknown as boolean })), /Modül/);
  });
});

describe("derslik ve ders saati", () => {
  it("kullanımdaki derslik silinemez, boştaki silinebilir", () => {
    reddedilir(dene((x) => (x.derslikler = x.derslikler.filter((d) => d.id !== "d1"))), /grubun/);
    const bos = structuredClone(db);
    bos.program = bos.program.filter((p) => p.derslikId !== "d3");
    expect(dene((x) => (x.derslikler = x.derslikler.filter((d) => d.id !== "d3")), YONETICI, bos)).not.toThrow();
  });
  it("geçersiz kapasite ve şube içinde yinelenen derslik adı reddedilir", () => {
    reddedilir(dene((x) => (x.derslikler = x.derslikler.map((d) => (d.id === "d1" ? { ...d, kapasite: -3 } : d)))), /Kapasite/);
    reddedilir(dene((x) => x.derslikler.push({ id: "d9", subeId: "s1", ad: "derslik 1", kapasite: 10 })), /aynı adlı/);
  });
  it("çakışan ders saati reddedilir; programda kullanılan saat silinemez", () => {
    reddedilir(dene((x) => x.dersSaatleri.push({ id: "h99", subeId: "s1", gunTipi: "hafta-ici", sira: 4, baslangic: "16:20", bitis: "17:00" })), /çakışıyor/);
    reddedilir(dene((x) => (x.dersSaatleri = x.dersSaatleri.filter((h) => h.id !== "h1"))), /programında/);
  });
  it("01 yetkisi verilen şube müdürü kendi şubesine derslik ekler, başka şubeye ekleyemez", () => {
    const yetkili = structuredClone(db);
    yetkili.rolYetkileri["sube-muduru"]["01"] = true;
    expect(dene((x) => x.derslikler.push({ id: "d9", subeId: "s1", ad: "Derslik 9", kapasite: 10 }), MUDUR_MERKEZ, yetkili)).not.toThrow();
    reddedilir(dene((x) => x.derslikler.push({ id: "d9", subeId: "s2", ad: "Derslik 9", kapasite: 10 }), MUDUR_MERKEZ, yetkili), /kapsam/);
  });
  it("varsayılan yetkide şube müdürü tanım yazamaz", () => {
    reddedilir(dene((x) => x.derslikler.push({ id: "d9", subeId: "s1", ad: "Derslik 9", kapasite: 10 }), MUDUR_MERKEZ), /yetkiniz yok/);
  });
});

describe("gruplar", () => {
  const yeni = { id: "g99", subeId: "s1", sezonId: "z2", seviye: 5, ad: "5-B", kapasite: 14, derslikId: "d1", rehberId: "p5" };
  it("geçerli grup eklenir", () => expect(dene((x) => x.gruplar.push(yeni))).not.toThrow());
  it("şube içinde aynı adlı grup reddedilir", () => reddedilir(dene((x) => x.gruplar.push({ ...yeni, ad: "5-a" })), /aynı adlı/));
  it("başka şubenin dersliği atanamaz", () => reddedilir(dene((x) => x.gruplar.push({ ...yeni, derslikId: "d4" })), /şubesine/));
  it("şubede görevli olmayan rehber öğretmen atanamaz", () => reddedilir(dene((x) => x.gruplar.push({ ...yeni, rehberId: "p2" })), /Rehber/));
  it("var olan grubun şubesi/sezonu değiştirilemez", () => {
    reddedilir(dene((x) => (x.gruplar = x.gruplar.map((g) => (g.id === "g2" ? { ...g, subeId: "s2", derslikId: "d4", rehberId: "p8" } : g)))), /değiştirilemez/);
  });
  it("kayıtlı öğrencisi olan grubun seviyesi değiştirilemez", () => {
    reddedilir(dene((x) => (x.gruplar = x.gruplar.map((g) => (g.id === "g2" ? { ...g, seviye: 6, ad: "6-B" } : g)))), /seviyesi/);
  });
  it("seviye dışı kapasite/seviye reddedilir", () => {
    reddedilir(dene((x) => x.gruplar.push({ ...yeni, seviye: 9 })), /Seviye/);
    reddedilir(dene((x) => x.gruplar.push({ ...yeni, kapasite: 0 })), /Kapasite/);
  });
  it("ilgisiz alan değişikliğinde eski derslik/rehber ataması yeniden denetlenmez", () => {
    const eski = structuredClone(db);
    eski.personel = eski.personel.map((p) => (p.id === "p5" ? { ...p, aktif: false } : p));
    expect(dene((x) => (x.gruplar = x.gruplar.map((g) => (g.id === "g2" ? { ...g, kapasite: 18 } : g))), YONETICI, eski)).not.toThrow();
  });
});
