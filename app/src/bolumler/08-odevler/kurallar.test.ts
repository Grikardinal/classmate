/** Bölüm 08 saf kuralları. Tarihler sabittir, gerçek saate bağlı değildir. */
import { describe, expect, it } from "vitest";
import type { Db, Gonderim, Kayit, Odev, Ogrenci, ProgramSatiri, TeslimDurumu } from "@/data/model";
import {
  kontrolDuzeltmeEngeli,
  kontrolZamanEngeli,
  notlarTemizle,
  odevBildirimiYineleniyor,
  odevDersleri,
  odevHedefleri,
  odevKontrolEdebilir,
  odevKontrolListesi,
  odevOgretmeni,
  odevSilmeEngeli,
  odevTemizle,
  odevYazmaEngeli,
  ogretmenOdevGorur,
  smsIzniUygula,
  teslimDurumuGecerli,
  teslimOzeti,
  veliOdevleri,
  yapmadiBildirimleri,
  yeniYapmayanlar,
  type OdevBaglami,
} from "./kurallar";

const BUGUN = "2026-11-09";
const satir = (id: string, p: Partial<ProgramSatiri>): ProgramSatiri => ({ id, grupId: "g1", gun: 1, saatId: "h1", dersId: "l1", ogretmenId: "p1", derslikId: "d1", baslangic: "2026-09-01", bitis: null, ...p });
const ogr = (id: string, ad = id) => ({ id, ad, soyad: "X" }) as Ogrenci;
const kayit = (ogrenciId: string, p: Partial<Kayit> = {}) => ({ id: `k${ogrenciId}`, ogrenciId, grupId: "g1", durum: "aktif", tarih: "2026-09-01", grupGecmisi: [{ grupId: "g1", tarih: "2026-09-01" }], ...p }) as Kayit;
const d = {
  program: [satir("a", {}), satir("b", { dersId: "l2", ogretmenId: "p2" }), satir("c", { dersId: "l3", ogretmenId: "p3", bitis: "2026-11-01" })],
  gruplar: [{ id: "g1", rehberId: "pR" }, { id: "g2", rehberId: "pZ" }],
  dersler: [{ id: "l1" }, { id: "l2" }, { id: "l3" }, { id: "l9" }],
  ogrenciler: [ogr("o1"), ogr("o2"), ogr("o3")],
  kayitlar: [kayit("o1"), kayit("o2"), kayit("o3", { grupId: "g2", grupGecmisi: [{ grupId: "g1", tarih: "2026-09-01" }, { grupId: "g2", tarih: "2026-11-01" }] })],
} as unknown as Db;
const odev = (p: Partial<Odev> = {}): Odev => ({ id: "od", ogretmenId: "p1", dersId: "l1", grupId: "g1", ogrenciIds: null, baslik: "Başlık", aciklama: "", kaynak: "", verilis: BUGUN, teslim: "2026-11-12", teslimler: {}, notlar: {}, kontrolEdildi: false, ...p });
const yonetici: OdevBaglami = { rol: "sube-muduru", personelId: "pM", bugun: BUGUN, modulAcik: true, ogretmenGruplari: null };
const ogretmen: OdevBaglami = { rol: "ogretmen", personelId: "p1", bugun: BUGUN, modulAcik: true, ogretmenGruplari: new Set(["g1"]) };
const vadesi = odev({ verilis: "2026-11-01", teslim: "2026-11-08" });

describe("ders ve öğretmen", () => {
  it("kapanmış satırın dersi grubun dersi sayılmaz", () => expect(odevDersleri(d, "g1", BUGUN)).toEqual(["l1", "l2"]));
  it("öğretmen kendi dersini alır; rehberlik ders vermez", () => {
    expect(odevDersleri(d, "g1", BUGUN, "p1")).toEqual(["l1"]);
    expect(odevDersleri(d, "g1", BUGUN, "pR")).toEqual([]);
  });
  it("kontrolü ödevin öğretmeni ve dersin bugünkü öğretmeni yapar", () => {
    const eskiOgretmen = odev({ ogretmenId: "pEski" });
    expect(odevKontrolEdebilir(eskiOgretmen, d, "pEski", BUGUN)).toBe(true);
    expect(odevKontrolEdebilir(eskiOgretmen, d, "p1", BUGUN)).toBe(true);
    expect(odevKontrolEdebilir(eskiOgretmen, d, "p2", BUGUN)).toBe(false);
    expect(odevKontrolEdebilir(eskiOgretmen, d, "pR", BUGUN)).toBe(false);
    expect(odevKontrolEdebilir(odev({ ogretmenId: "pEski", dersId: "l3" }), d, "p3", BUGUN)).toBe(false);
  });
  it("ödevin öğretmeni açık satırdan bulunur", () => {
    expect(odevOgretmeni(d, "g1", "l2", BUGUN)).toBe("p2");
    expect(odevOgretmeni(d, "g1", "l3", BUGUN)).toBeNull();
  });
});

describe("hedef öğrenciler", () => {
  it("teslim tarihindeki gruba göre hesaplanır", () => {
    expect(odevHedefleri(d, odev()).map((x) => x.id)).toEqual(["o1", "o2"]);
    expect(odevHedefleri(d, odev({ grupId: "g2" })).map((x) => x.id)).toEqual(["o3"]);
    expect(odevHedefleri(d, odev({ teslim: "2026-10-20" })).map((x) => x.id)).toEqual(["o1", "o2", "o3"]);
  });
  it("seçili öğrencilerle sınırlanır", () => expect(odevHedefleri(d, odev({ ogrenciIds: ["o2"] })).map((x) => x.id)).toEqual(["o2"]));
  it("durumu işaretlenmiş ayrılan öğrenci kontrol listesinde kalır", () => expect(odevKontrolListesi(d, odev({ teslimler: { o3: "eksik" } })).map((x) => x.id)).toEqual(["o1", "o2", "o3"]));
});

describe("yeni ödev denetimi", () => {
  const dene = (p: Partial<Odev>, b: OdevBaglami = yonetici) => odevYazmaEngeli(odev(p), undefined, d, b);
  it("geçerli ödev kabul edilir", () => {
    expect(dene({})).toBeNull();
    expect(dene({}, ogretmen)).toBeNull();
  });
  it("modül kapalıyken reddedilir", () => expect(dene({}, { ...yonetici, modulAcik: false })).toMatch(/kapalı/));
  it("boş başlık, uzun metin, bozuk metin alanı", () => {
    expect(dene({ baslik: "   " })).toMatch(/boş/);
    expect(dene({ baslik: "x".repeat(201) })).toMatch(/200/);
    expect(dene({ aciklama: 5 as unknown as string })).toMatch(/hatalı/);
  });
  it("tarih geçerli olmalı, verilişten önce olamaz", () => {
    expect(dene({ teslim: "2026-02-31" })).toMatch(/Geçersiz/);
    expect(dene({ teslim: "" })).toMatch(/Geçersiz/);
    expect(dene({ teslim: "2026-11-08" })).toMatch(/önce/);
    expect(dene({ teslim: BUGUN })).toBeNull();
  });
  it("grup ve ders var olmalı, grup dersi almalı", () => {
    expect(dene({ grupId: "yok" })).toMatch(/Grup/);
    expect(dene({ dersId: "yok" })).toMatch(/Ders/);
    expect(dene({ dersId: "l9" })).toMatch(/almıyor/);
    expect(dene({ dersId: "l3" })).toMatch(/almıyor/);
  });
  it("öğretmen başka grup ve başka ders veremez", () => {
    expect(dene({ grupId: "g2" }, ogretmen)).toMatch(/kendi grup/);
    expect(dene({ dersId: "l2" }, ogretmen)).toMatch(/kendi dersiniz/);
  });
  it("seçili öğrenciler dolu ve grupta olmalı", () => {
    expect(dene({ ogrenciIds: [] })).toMatch(/seçilmeli/);
    expect(dene({ ogrenciIds: ["o3"] })).toMatch(/grupta/);
    expect(dene({ ogrenciIds: ["o1"] })).toBeNull();
  });
});

describe("teslim kontrolü denetimi", () => {
  const kontrol = (t: Record<string, TeslimDurumu>, p: Partial<Odev> = {}, eski: Odev = vadesi, b: OdevBaglami = ogretmen) => odevYazmaEngeli({ ...eski, teslimler: t, kontrolEdildi: true, ...p }, eski, d, b);
  it("geçerli işaretleme kabul edilir", () => expect(kontrol({ o1: "yapti", o2: "yapmadi" })).toBeNull());
  it("geçersiz durum ve hedef dışı öğrenci reddedilir", () => {
    expect(kontrol({ o1: "bilinmez" as TeslimDurumu })).toMatch(/Geçersiz/);
    expect(kontrol({ yabanci: "yapti" })).toMatch(/hedefinde/);
  });
  it("ayrılan öğrencinin eski kaydı düzeltilebilir", () => expect(kontrol({ o3: "eksik" }, {}, odev({ ...vadesi, teslimler: { o3: "yapti" }, kontrolEdildi: true }))).toBeNull());
  it("teslim tarihi gelmeden kontrol yapılamaz", () => {
    expect(kontrol({ o1: "yapti" }, {}, odev())).toMatch(/gelmeden/);
    expect(kontrolZamanEngeli(BUGUN, BUGUN)).toBeNull();
  });
  it("kontrolsüz durum yazılamaz, kontrol geri alınamaz", () => {
    expect(odevYazmaEngeli({ ...vadesi, teslimler: { o1: "yapti" } }, vadesi, d, ogretmen)).toMatch(/kontrolle/);
    const yapilmis = odev({ ...vadesi, kontrolEdildi: true, teslimler: { o1: "yapti" } });
    expect(odevYazmaEngeli({ ...yapilmis, kontrolEdildi: false }, yapilmis, d, ogretmen)).toMatch(/geri alınamaz/);
  });
  it("hiç öğrenci işaretlenmeden kontrol yapılamaz", () => expect(kontrol({})).toMatch(/öğrenci yok/));
  it("not uzunluğu ve durumsuz öğrenciye not", () => {
    expect(kontrol({ o1: "eksik" }, { notlar: { o1: "x".repeat(301) } })).toMatch(/300/);
    expect(kontrol({ o1: "eksik" }, { notlar: { o2: "not" } })).toMatch(/teslim durumu olan/);
  });
  it("başkasının dersindeki ödevi öğretmen değiştiremez, yönetici değiştirir", () => {
    const baska = odev({ ...vadesi, ogretmenId: "p2", dersId: "l2" });
    expect(kontrol({ o1: "yapti" }, {}, baska)).toMatch(/kendi ödev/);
    expect(kontrol({ o1: "yapti" }, {}, baska, yonetici)).toBeNull();
  });
  it("dersi devralan yalnızca teslim kontrolü yapar", () => {
    const devir = odev({ ...vadesi, ogretmenId: "pEski" });
    expect(kontrol({ o1: "yapti" }, {}, devir)).toBeNull();
    expect(kontrol({ o1: "yapti" }, { baslik: "Yeni" }, devir)).toMatch(/yalnızca teslim kontrolü/);
    expect(kontrol({ o1: "yapti" }, { teslim: "2026-11-07" }, devir)).toMatch(/yalnızca teslim kontrolü/);
    expect(kontrol({ o1: "yapti" }, { ogretmenId: "p1" }, devir)).toMatch(/yalnızca teslim kontrolü/);
    expect(odevSilmeEngeli(devir, ogretmen)).toMatch(/kendi/);
  });
  it("öğretmen kontrolü 7 gün düzeltir, sonrası yönetici", () => {
    const k = (kontrolTarihi: string) => odev({ ...vadesi, kontrolEdildi: true, kontrolTarihi, teslimler: { o1: "yapti" } });
    expect(kontrol({ o1: "eksik" }, {}, k("2026-11-02"))).toBeNull();
    expect(kontrol({ o1: "eksik" }, {}, k("2026-11-01"))).toMatch(/7 günden eski/);
    expect(kontrol({ o1: "eksik" }, {}, k("2026-11-01"), yonetici)).toBeNull();
  });
  it("kontrol tarihi olmayan eski kayıtta teslim tarihi esas alınır", () => {
    const k = (teslim: string) => odev({ verilis: "2026-10-01", teslim, kontrolEdildi: true, teslimler: { o1: "yapti" } });
    expect(kontrolDuzeltmeEngeli(k("2026-11-02"), "ogretmen", BUGUN)).toBeNull();
    expect(kontrolDuzeltmeEngeli(k("2026-11-01"), "ogretmen", BUGUN)).toMatch(/yönetici/);
    expect(kontrolDuzeltmeEngeli(k("2026-11-01"), "sube-muduru", BUGUN)).toBeNull();
    expect(kontrol({ o1: "yapti" }, {}, odev({ ...vadesi, teslim: "2026-10-01", verilis: "2026-09-20", kontrolEdildi: false }))).toBeNull();
  });
  it("grup değiştirilemez; eski kayıttaki değişmeyen alanlar kilitlemez", () => {
    expect(odevYazmaEngeli({ ...vadesi, grupId: "g2" }, vadesi, d, yonetici)).toMatch(/grubu/);
    const kapali = odev({ ...vadesi, dersId: "l3" });
    expect(odevYazmaEngeli({ ...kapali, teslimler: { o1: "yapti" }, kontrolEdildi: true }, kapali, d, yonetici)).toBeNull();
  });
  it("devredilen grupta öğretmen yazamaz", () => expect(kontrol({ o1: "yapti" }, {}, vadesi, { ...ogretmen, ogretmenGruplari: new Set() })).toMatch(/kendi grup/));
});

describe("silme", () => {
  it("modül kapalıysa kimse silemez", () => expect(odevSilmeEngeli(odev(), { ...yonetici, modulAcik: false })).toMatch(/kapalı/));
  it("öğretmen yalnızca kendi kontrol edilmemiş ödevini siler", () => {
    expect(odevSilmeEngeli(odev(), ogretmen)).toBeNull();
    expect(odevSilmeEngeli(odev({ ogretmenId: "p2" }), ogretmen)).toMatch(/kendi/);
    expect(odevSilmeEngeli(odev({ kontrolEdildi: true }), ogretmen)).toMatch(/yönetici/);
    expect(odevSilmeEngeli(odev(), { ...ogretmen, ogretmenGruplari: new Set() })).toMatch(/kendi/);
  });
  it("yönetici kontrol edilmişi de siler", () => expect(odevSilmeEngeli(odev({ kontrolEdildi: true }), yonetici)).toBeNull());
});

describe("temizleme", () => {
  it("yeni ödevde öğretmen, veriliş, teslimler sunucudan", () => {
    const s = odevTemizle(odev({ baslik: " A ", ogretmenId: "sahte", verilis: "2020-01-01", teslimler: { o1: "yapti" }, notlar: { o1: "x" }, kontrolEdildi: true }), undefined, "p1", BUGUN);
    expect(s).toMatchObject({ baslik: "A", ogretmenId: "p1", verilis: BUGUN, teslimler: {}, notlar: {}, kontrolEdildi: false });
  });
  it("güncellemede öğretmen ve veriliş korunur, eski durumlar birleşir", () => {
    const eski = odev({ verilis: "2026-11-01", teslimler: { o3: "eksik", o1: "eksik" }, notlar: { o3: "not", o1: "eski" } });
    const s = odevTemizle({ ...eski, ogretmenId: "sahte", verilis: BUGUN, teslimler: { o1: "yapti" }, notlar: { o1: "eski" } }, eski, "p9", BUGUN);
    expect(s).toMatchObject({ ogretmenId: "p1", verilis: "2026-11-01", teslimler: { o3: "eksik", o1: "yapti" }, notlar: { o3: "not" } });
  });
  it("kontrol tarihi sunucudan: ilk kontrolde yazılır, düzeltmede değişmez, istemci belirleyemez", () => {
    const acik = odev();
    expect(odevTemizle({ ...acik, kontrolEdildi: true, kontrolTarihi: "2030-01-01" }, acik, "p1", BUGUN).kontrolTarihi).toBe(BUGUN);
    const yapilmis = odev({ kontrolEdildi: true, kontrolTarihi: "2026-11-03" });
    expect(odevTemizle({ ...yapilmis, kontrolTarihi: "2030-01-01" }, yapilmis, "p1", BUGUN).kontrolTarihi).toBe("2026-11-03");
    const eskiKayit = odev({ kontrolEdildi: true });
    expect(odevTemizle({ ...eskiKayit, kontrolTarihi: "2030-01-01" }, eskiKayit, "p1", BUGUN).kontrolTarihi).toBeUndefined();
    expect(odevTemizle(odev({ kontrolTarihi: "2030-01-01" }), undefined, "p1", BUGUN).kontrolTarihi).toBeUndefined();
  });
  it("notlar: yaptı, boş ve durumsuz atılır", () => expect(notlarTemizle({ a: " n ", b: "x", c: "  ", d: "y" }, { a: "eksik", b: "yapti", c: "eksik" })).toEqual({ a: "n" }));
  it("durum değeri", () => {
    expect(teslimDurumuGecerli("yapti")).toBe(true);
    expect(teslimDurumuGecerli("x")).toBe(false);
  });
});

describe("görünürlük", () => {
  it("öğretmen kendi ödevini ve rehberi olduğu grubu görür", () => {
    expect(ogretmenOdevGorur(odev(), d, "p1", BUGUN)).toBe(true);
    expect(ogretmenOdevGorur(odev({ ogretmenId: "p2", dersId: "l2" }), d, "pR", BUGUN)).toBe(true);
    expect(ogretmenOdevGorur(odev({ ogretmenId: "p2", dersId: "l2" }), d, "p1", BUGUN)).toBe(false);
  });
  it("veli yalnızca çocuğunun ödevini ve durumunu alır", () => {
    const k = [kayit("o1"), kayit("o2"), kayit("o3", { grupId: "g2" })];
    const l = veliOdevleri([odev({ teslimler: { o1: "yapti", o2: "eksik" }, notlar: { o2: "gizli" } }), odev({ id: "b", ogrenciIds: ["o2"] }), odev({ id: "c", grupId: "g2" })], k, new Set(["o1"]));
    expect(l.map((x) => x.id)).toEqual(["od"]);
    expect(l[0].teslimler).toEqual({ o1: "yapti" });
    expect(l[0].notlar).toEqual({});
  });
  it("iptal kaydın grubu velide görünmez", () => expect(veliOdevleri([odev()], [kayit("o1", { durum: "iptal" })], new Set(["o1"]))).toEqual([]));
});

describe("bildirim", () => {
  const g = (p: Partial<Gonderim> = {}) => ({ olay: "odevYapmadi", veliId: "v", ogrenciId: "o1", metin: "m", ...p }) as Gonderim;
  it("yeni yapmayanlar: daha önce yapmadı olan sayılmaz", () => expect(yeniYapmayanlar({ a: "yapmadi", b: "yapmadi", c: "yapti" }, { b: "yapmadi" })).toEqual(["a"]));
  it("aynı ödev tekrar etmez, aynı başlıklı başka ödev gider", () => {
    expect(odevBildirimiYineleniyor(g(), "x", [g({ odevId: "x" })])).toBe(true);
    expect(odevBildirimiYineleniyor(g(), "y", [g({ odevId: "x" })])).toBe(false);
  });
  it("kimliksiz eski kayıt metinle eşleşir; başka veli ve olay sayılmaz", () => {
    expect(odevBildirimiYineleniyor(g(), "x", [g()])).toBe(true);
    expect(odevBildirimiYineleniyor(g(), "x", [g({ veliId: "z" }), g({ olay: "yeniOdev" })])).toBe(false);
  });
  it("yapmadı bildirimleri ödev kimliğiyle, eski kayıt başlıkla eşleşir", () => {
    const o = { id: "x", baslik: "Kesir" };
    const l = [g({ odevId: "x", metin: "a" }), g({ metin: "Kesir ödevi" }), g({ odevId: "y", metin: "Kesir" }), g({ olay: "yeniOdev", odevId: "x" }), g({ odevId: "x", ogrenciId: "o2" })];
    expect(yapmadiBildirimleri(l, o, "o1")).toEqual([l[0], l[1]]);
  });
  it("SMS izni kapalı veliye push", () => {
    const s = { kanal: "sms" as const, veliId: "v", maliyet: 2 };
    smsIzniUygula(s, [{ id: "v", izinSms: false }]);
    expect(s).toEqual({ kanal: "push", veliId: "v", maliyet: 0 });
  });
});

describe("oran", () => {
  it("yalnızca kontrol edilmiş ödev ve işaretlenen öğrenciler sayılır", () => {
    const o = teslimOzeti([{ kontrolEdildi: true, teslimler: { a: "yapti", b: "eksik", c: "yapmadi", d: "yapti" } }, { kontrolEdildi: false, teslimler: { e: "yapmadi" } }]);
    expect(o).toEqual({ verilen: 2, kontrol: 1, oran: 0.5, eksik: 1, yapmadi: 1 });
  });
  it("kontrol yoksa oran yok", () => expect(teslimOzeti([{ kontrolEdildi: false, teslimler: {} }]).oran).toBeNull());
});
