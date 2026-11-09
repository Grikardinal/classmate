/** Bölüm 13 saf kuralları. Tarihler parametreyle verilir; gerçek saate bağlı değildir. */
import { describe, expect, it } from "vitest";
import type { Db, DonmusHakedis, Personel, ProgramSatiri, Randevu, Yoklama } from "@/data/model";
import {
  acikProgram, farkAktar, hakedisDuzeltmeEngeli, hakedisimOzeti, atamaEngeli, avansEngeli, ayGecerli, etutSayilir, etutUcretiEngeli, gecerliAvanslar, hakEdisHesabi, hakEdisteGorunur, hakedisAnahtari, hakedisAylari,
  hakedisDurumEngeli, islenenOturumlar, kartYetkiEngeli, maskeliAlanlariKoru, pasifeAlmaEngeli, personelDogrula, personelMaskele, personelSilmeEngeli, personelTemizle, ucretEngeli, ucretGorur,
  type Avans, type DurumBaglami, type Goren,
} from "./kurallar";

const BUGUN = "2026-11-09";
const AY = "2026-10";
const p = (x: Partial<Personel> = {}): Personel => ({ id: "t", ad: "Ayşe", soyad: "Kaya", gorev: "ogretmen", telefon: "0532 111 22 33", eposta: "a@b.com", subeIds: ["s1"], anaSubeId: "s1", dersIds: ["l1"], baslangic: "2024-09-01", aktif: true, ucretTipi: "ders", dersUcreti: 100, sabitUcret: 0, ...x });
const y = (id: string, x: Partial<Yoklama> = {}) => ({ oturumId: id, satirId: "pr1", grupId: "g1", tarih: `${AY}-06`, ogretmenId: "t", konu: "", durumlar: {}, kayitZamani: "", ...x }) as Yoklama;
const r = (x: Partial<Randevu> = {}): Randevu => ({ id: "r1", ogretmenId: "t", subeId: "s1", tarih: `${AY}-07`, bas: "14:00", bit: "14:40", tur: "bireysel", ogrenciIds: ["o1"], dersId: "l1", durum: "yapildi", link: "", paketId: null, olusturan: "yonetim", ...x });
const av = (x: Partial<Avans> = {}): Avans => ({ id: "a1", personelId: "t", tarih: `${AY}-10`, tutar: 50, aciklama: "Avans", subeId: "s1", ...x });
const hesap = (x: Record<string, unknown> = {}) => ({ yoklamalar: {}, randevular: [], gruplar: [{ id: "g1", subeId: "s1" }, { id: "g2", subeId: "s2" }], iptaller: [], tatiller: [], avanslar: [], giderler: [], ...x }) as unknown as Parameters<typeof hakEdisHesabi>[0];
const yok = (...l: Yoklama[]) => Object.fromEntries(l.map((v) => [v.oturumId, v]));
const satir = (x: Partial<ProgramSatiri> = {}) => ({ id: "pr1", grupId: "g1", dersId: "l1", ogretmenId: "t", gun: 1, saatId: "h1", baslangic: "2026-09-01", ...x }) as ProgramSatiri;
const kart = { personel: [p(), p({ id: "b", telefon: "0532 000 00 01", eposta: "x@y.com" })], subeler: [{ id: "s1", aktif: true }, { id: "s2", aktif: false }], dersler: [{ id: "l1" }] } as unknown as Pick<Db, "personel" | "subeler" | "dersler">;
const atama = (x: Record<string, unknown> = {}) => ({ program: [], randevular: [], gruplar: [{ id: "g1", subeId: "s1" }, { id: "g2", subeId: "s2" }], ...x }) as unknown as Pick<Db, "program" | "randevular" | "gruplar">;

describe("hak ediş: işlenen ders", () => {
  it("yalnızca kendi yoklaması ve ayın sınırları içi sayılır", () => {
    const d = hesap({ yoklamalar: yok(y("a"), y("b", { ogretmenId: "z" }), y("c", { tarih: "2026-09-30" }), y("d", { tarih: "2026-11-01" }), y("e", { tarih: "2026-10-31" })) });
    expect(islenenOturumlar(d, "t", AY).map((x) => x.oturumId)).toEqual(["a", "e"]);
  });
  it("iptal ve tatile denk gelen oturum sayılmaz; başka şubenin tatili etkilemez", () => {
    const d = hesap({ yoklamalar: yok(y("a"), y("b", { tarih: `${AY}-13` }), y("c", { tarih: `${AY}-20` })), iptaller: [{ oturumId: "a" }], tatiller: [{ tarih: `${AY}-13`, subeId: null }, { tarih: `${AY}-20`, subeId: "s2" }] });
    expect(islenenOturumlar(d, "t", AY).map((x) => x.oturumId)).toEqual(["c"]);
  });
  it("yoklama düzeltmesi sayıyı değiştirmez; oturum iki öğretmene sayılmaz", () => {
    const duz = hesap({ yoklamalar: yok(y("a", { durumlar: { o1: "gelmedi" } })) });
    expect(hakEdisHesabi(duz, p(), AY).dersSayisi).toBe(1);
    expect(hakEdisHesabi(duz, p({ id: "z" }), AY).dersSayisi).toBe(0);
  });
  it("ücret tipleri ve kuruş hassasiyeti", () => {
    const d = hesap({ yoklamalar: yok(y("a"), y("b"), y("c")) });
    expect(hakEdisHesabi(d, p({ dersUcreti: 33.33 }), AY).tutar).toBe(99.99);
    expect(hakEdisHesabi(d, p({ ucretTipi: "sabit", sabitUcret: 1000 }), AY).tutar).toBe(1000);
    expect(hakEdisHesabi(d, p({ ucretTipi: "karma", sabitUcret: 1000 }), AY).tutar).toBe(1300);
  });
  it("şube dağılımı toplama eşit; artık şubesinde olmayan dersin payı kaybolmaz", () => {
    const d = hesap({ yoklamalar: yok(y("a"), y("b", { grupId: "g2" }), y("c", { grupId: "g2" })) });
    const h = hakEdisHesabi(d, p({ dersUcreti: 33.33 }), AY);
    expect(h.dagilim).toEqual([{ subeId: "s1", tutar: 33.33 }, { subeId: "s2", tutar: 66.66 }]);
    expect(h.subeBazinda.reduce((t, x) => t + x.n, 0)).toBe(h.dersSayisi);
  });
});

describe("hak ediş: avans", () => {
  const d = (x: Record<string, unknown>) => hesap({ yoklamalar: yok(y("a"), y("b", { grupId: "g2" })), ...x });
  it("avans kendi şubesinin payından düşer, artan diğer şubeden", () => {
    expect(hakEdisHesabi(d({ avanslar: [av({ tutar: 30 })] }), p(), AY).dagilim).toEqual([{ subeId: "s1", tutar: 70 }, { subeId: "s2", tutar: 100 }]);
    expect(hakEdisHesabi(d({ avanslar: [av({ tutar: 130 })] }), p(), AY).dagilim).toEqual([{ subeId: "s2", tutar: 70 }]);
  });
  it("karma ücrette avans sabitten büyükse tutar yine doğru düşer (toplam = ödenecek)", () => {
    const h = hakEdisHesabi(d({ avanslar: [av({ tutar: 150 })] }), p({ ucretTipi: "karma", sabitUcret: 100 }), AY);
    expect(h.odenecek).toBe(150);
    expect(h.dagilim.reduce((t, x) => t + x.tutar, 0)).toBe(150);
  });
  it("avans hak edişi aşarsa gider yazılmaz, net eksi çıkmaz, fazlası sonraki aya devreder", () => {
    const h = hakEdisHesabi(d({ avanslar: [av({ tutar: 500 })] }), p(), AY);
    expect(h.dagilim).toEqual([]);
    expect(h.odenecek).toBe(0);
    expect(h.fazlaAvans).toBe(300);
    const kasim = hakEdisHesabi(hesap({ yoklamalar: yok(y("a"), y("k", { tarih: "2026-11-02" })), avanslar: [av({ tutar: 500 })] }), p(), "2026-11");
    expect(kasim.devredenAvans).toBe(400);
    expect(kasim.fazlaAvans).toBe(300);
    expect(kasim.odenecek).toBe(0);
  });
  it("ayrılan öğretmenin kalan devri görünür kalır", () => {
    const h = hakEdisHesabi(hesap({ avanslar: [av({ tutar: 90 })] }), p({ aktif: false }), "2026-12");
    expect(h.devredenAvans).toBe(90);
    expect(hakEdisteGorunur({ aktif: false, baslangic: "2020-01-01" }, "2026-12", h)).toBe(true);
  });
  it("gideri iptal edilen avans düşülmez; başka ayın avansı düşülmez", () => {
    expect(gecerliAvanslar({ avanslar: [av({ giderId: "gd" })], giderler: [{ id: "gd", iptal: { neden: "x" } }] } as never, "t", AY)).toEqual([]);
    expect(gecerliAvanslar({ avanslar: [av({ tarih: "2026-09-30" })], giderler: [] } as never, "t", AY)).toEqual([]);
  });
});

describe("hak ediş: etüt (karar 2026-11-08)", () => {
  it("yalnızca yapıldı sayılır; grup etüdünde en az bir öğrenci gelmeli", () => {
    expect(etutSayilir(r())).toBe(true);
    for (const durum of ["planli", "gelmedi", "iptal"] as const) expect(etutSayilir(r({ durum }))).toBe(false);
    expect(etutSayilir(r({ sonuclar: { a: "gelmedi", b: "yapildi" } }))).toBe(true);
    expect(etutSayilir(r({ sonuclar: { a: "gelmedi", b: "gelmedi" } }))).toBe(false);
  });
  it("varsayılan 0: mevcut hak ediş değişmez", () => {
    const h = hakEdisHesabi(hesap({ randevular: [r()] }), p(), AY);
    expect([h.etutSayisi, h.tutar]).toEqual([1, 0]);
  });
  it("ücret ders başına eklenir, randevunun şubesine yazılır, ay dışı sayılmaz", () => {
    const d = hesap({ kurum: { etutDersUcreti: 75.5 }, randevular: [r(), r({ id: "r2", subeId: "s2" }), r({ id: "r3", tarih: "2026-11-01" })] });
    const h = hakEdisHesabi(d, p(), AY);
    expect(h.tutar).toBe(151);
    expect(h.dagilim).toEqual([{ subeId: "s1", tutar: 75.5 }, { subeId: "s2", tutar: 75.5 }]);
  });
  it("sonuç düzeltmesi hesaba yansır", () => {
    const d = (durum: Randevu["durum"]) => hesap({ kurum: { etutDersUcreti: 50 }, randevular: [r({ durum })] });
    expect(hakEdisHesabi(d("yapildi"), p(), AY).tutar).toBe(50);
    expect(hakEdisHesabi(d("gelmedi"), p(), AY).tutar).toBe(0);
  });
  it("ücret doğrulaması", () => {
    expect(etutUcretiEngeli(undefined)).toBeNull();
    expect(etutUcretiEngeli(0)).toBeNull();
    expect(etutUcretiEngeli(-1)).toMatch(/pozitif/);
    expect(etutUcretiEngeli(1.234)).toMatch(/kuruş/);
    expect(etutUcretiEngeli("5")).toMatch(/pozitif/);
  });
});

describe("hak ediş: dondurma ve fark (karar 2026-11-09)", () => {
  const donmus = (x: Partial<DonmusHakedis> = {}): DonmusHakedis => ({ tutar: 100, dersSayisi: 1, etutSayisi: 0, birimDers: 100, birimEtut: 0, avans: 0, devredenAvans: 0, fazlaAvans: 0, oncekiFark: 0, odenecek: 100, farkKaynak: [], aktarilan: 0, giderIds: [], ...x });
  const iki = yok(y("a"), y("b", { tarih: `${AY}-13` }));
  const kasim = "2026-11";
  it("ödenmiş ay dondurulan tutarı gösterir, ücret değişimi etkilemez", () => {
    const h = hakEdisHesabi(hesap({ yoklamalar: iki, hakedisDurum: { [`${AY}_t`]: { durum: "odendi", donmus: donmus() } } }), p({ dersUcreti: 999 }), AY);
    expect([h.tutar, h.dersSayisi, h.odenecek, h.donduruldu]).toEqual([100, 1, 100, true]);
  });
  it("sonradan gelen ders farkı sonraki ödenmemiş aya girer (ödeme anındaki birimle)", () => {
    const h = hakEdisHesabi(hesap({ yoklamalar: iki, hakedisDurum: { [`${AY}_t`]: { durum: "odendi", donmus: donmus() } } }), p({ dersUcreti: 999 }), kasim);
    expect(h.oncekiFark).toBe(100);
    expect(h.odenecek).toBe(100);
    expect(h.farkKaynak).toEqual([{ ay: AY, tutar: 100 }]);
  });
  it("fark yalnızca ilk ödenmemiş aya girer, ara ödenmiş ay atlanır", () => {
    const hd = { [`${AY}_t`]: { durum: "odendi" as const, donmus: donmus() }, "2026-11_t": { durum: "odendi" as const, donmus: donmus({ tutar: 0, dersSayisi: 0 }) } };
    const d = hesap({ yoklamalar: iki, hakedisDurum: hd });
    expect(hakEdisHesabi(d, p(), "2026-12").oncekiFark).toBe(100);
    expect(hakEdisHesabi(d, p(), "2027-01").oncekiFark).toBe(0);
  });
  it("taşınan fark iki kez sayılmaz; ödeme iptali geri açar", () => {
    const v = { durum: "odendi" as const, donmus: donmus() };
    const aktarilmis = farkAktar(v, 100);
    expect(hakEdisHesabi(hesap({ yoklamalar: iki, hakedisDurum: { [`${AY}_t`]: aktarilmis } }), p(), kasim).oncekiFark).toBe(0);
    expect(hakEdisHesabi(hesap({ yoklamalar: iki, hakedisDurum: { [`${AY}_t`]: farkAktar(aktarilmis, -100) } }), p(), kasim).oncekiFark).toBe(100);
  });
  it("negatif fark net eksiye düşürmez, kalanı devreder", () => {
    const d = hesap({ yoklamalar: {}, hakedisDurum: { [`${AY}_t`]: { durum: "odendi", donmus: donmus() } } });
    const h = hakEdisHesabi(d, p(), kasim);
    expect([h.oncekiFark, h.odenecek, h.fazlaAvans]).toEqual([-100, 0, 100]);
  });
  it("dondurulmamış eski ödenmiş satırda fark hesaplanmaz", () => {
    expect(hakEdisHesabi(hesap({ yoklamalar: iki, hakedisDurum: { [`${AY}_t`]: "odendi" } }), p(), kasim).oncekiFark).toBe(0);
    expect(hakEdisHesabi(hesap({ yoklamalar: iki, hakedisDurum: { [`${AY}_t`]: "odendi" } }), p(), AY).donduruldu).toBe(false);
  });
  it("elle düzeltme hak edişe ve ana şubeye girer; eksi tutar kesinti olur", () => {
    const d = (tutar: number) => hesap({ yoklamalar: iki, hakedisDurum: { [`${AY}_t`]: { duzeltme: { tutar, neden: "ay ortası", kullanici: "", zaman: "" } } } });
    expect(hakEdisHesabi(d(50), p(), AY)).toMatchObject({ tutar: 250, duzeltme: 50, odenecek: 250 });
    expect(hakEdisHesabi(d(-50), p(), AY)).toMatchObject({ tutar: 150, odenecek: 150 });
  });
  it("düzeltme kuralları", () => {
    const b: DurumBaglami = { hakedisAcik: true, finansAcik: true, rol: "genel-yonetici", bugun: BUGUN, tamKapsam: true, personel: [{ id: "t", gorev: "ogretmen" }] };
    const k = `${AY}_t`;
    expect(hakedisDuzeltmeEngeli(k, { tutar: -5, neden: "abc" }, {}, b)).toBeNull();
    expect(hakedisDuzeltmeEngeli(k, { tutar: 5, neden: "ab" }, {}, b)).toMatch(/3 karakter/);
    expect(hakedisDuzeltmeEngeli(k, { tutar: 0, neden: "abc" }, {}, b)).toMatch(/sıfırdan/);
    expect(hakedisDuzeltmeEngeli(k, { tutar: 5, neden: "abc" }, { durum: "odendi" }, b)).toMatch(/Ödenmiş/);
    expect(hakedisDuzeltmeEngeli(k, { tutar: 5, neden: "abc" }, {}, { ...b, rol: "sube-muduru", tamKapsam: false })).toMatch(/genel yönetici/);
    expect(hakedisDuzeltmeEngeli(k, { tutar: 5, neden: "abc" }, {}, { ...b, rol: "sekreter" })).toMatch(/yönetici/);
  });
  it("Hakedişim dökümü; finans kapalıyken tutar yok", () => {
    const d = hesap({ yoklamalar: yok(y("a")), hakedisDurum: { [`${AY}_t`]: "onaylandi" } });
    expect(hakedisimOzeti(d, p(), BUGUN, true).find((r) => r.ay === AY)).toMatchObject({ durum: "onaylandi", dersSayisi: 1, tutar: 100, odenecek: 100 });
    expect(hakedisimOzeti(d, p(), BUGUN, false).find((r) => r.ay === AY)).toMatchObject({ dersSayisi: 1, tutar: 0, odenecek: 0 });
  });
});

describe("hak ediş: ay ve görünürlük", () => {
  it("aylar bugüne göre üretilir, gelecek yok, verisi olan eski ay eklenir", () => {
    const l = hakedisAylari({ yoklamalar: yok(y("a", { tarih: "2024-03-01" })), randevular: [], hakedisDurum: {} }, BUGUN);
    expect(l[0]).toBe("2026-11");
    expect(l).toContain("2025-12");
    expect(l).toContain("2024-03");
    expect(l).not.toContain("2026-12");
    expect(hakedisAylari({ yoklamalar: {}, randevular: [], hakedisDurum: {} }, "2027-01-15").slice(0, 2)).toEqual(["2027-01", "2026-12"]);
  });
  it("ay biçimi ve anahtar", () => {
    expect(ayGecerli("2026-13")).toBe(false);
    expect(hakedisAnahtari("2026-10_p4")).toEqual({ ay: "2026-10", personelId: "p4" });
    expect(hakedisAnahtari("hatali")).toBeNull();
  });
  it("pasif veya henüz başlamamış öğretmene boş satır (sabit maaş) çıkmaz", () => {
    const bos = { dersSayisi: 0, etutSayisi: 0 };
    expect(hakEdisteGorunur({ aktif: false, baslangic: "2020-01-01" }, AY, bos)).toBe(false);
    expect(hakEdisteGorunur({ aktif: false, baslangic: "2020-01-01" }, AY, { dersSayisi: 1, etutSayisi: 0 })).toBe(true);
    expect(hakEdisteGorunur({ aktif: true, baslangic: "2026-11-01" }, AY, bos)).toBe(false);
    expect(hakEdisteGorunur({ aktif: true, baslangic: "2026-10-20" }, AY, bos)).toBe(true);
  });
});

describe("hak ediş durumu", () => {
  const b: DurumBaglami = { hakedisAcik: true, finansAcik: true, rol: "genel-yonetici", bugun: BUGUN, tamKapsam: true, personel: [{ id: "t", gorev: "ogretmen" }, { id: "s", gorev: "sekreter" }] };
  const k = `${AY}_t`;
  it("akış: yok → onaylı → ödendi", () => {
    expect(hakedisDurumEngeli(k, "onaylandi", undefined, b)).toBeNull();
    expect(hakedisDurumEngeli(k, "odendi", "onaylandi", b)).toBeNull();
    expect(hakedisDurumEngeli(k, "odendi", undefined, b)).toMatch(/Önce/);
    expect(hakedisDurumEngeli(k, "onaylandi", "odendi", b)).toMatch(/Ödenmiş/);
  });
  it("ay bitmeden onay yok; modül kapalıysa yok; geçersiz kayıt yok", () => {
    expect(hakedisDurumEngeli("2026-11_t", "onaylandi", undefined, b)).toMatch(/Ay bitmeden/);
    expect(hakedisDurumEngeli(k, "onaylandi", undefined, { ...b, finansAcik: false })).toMatch(/modülleri/);
    expect(hakedisDurumEngeli(`${AY}_s`, "onaylandi", undefined, b)).toMatch(/geçersiz/);
    expect(hakedisDurumEngeli(k, "x", undefined, b)).toMatch(/geçersiz/);
  });
  it("müdür yalnızca tam kapsamda onaylar; ödemeyi genel yönetici işaretler", () => {
    const m = { ...b, rol: "sube-muduru" as const };
    expect(hakedisDurumEngeli(k, "onaylandi", undefined, m)).toBeNull();
    expect(hakedisDurumEngeli(k, "onaylandi", undefined, { ...m, tamKapsam: false })).toMatch(/genel yönetici/);
    expect(hakedisDurumEngeli(k, "odendi", "onaylandi", m)).toMatch(/genel yönetici/);
  });
});

describe("avans", () => {
  const b = { hakedisAcik: true, finansAcik: true, tamKapsam: true };
  it("geçerli avans ve engeller", () => {
    expect(avansEngeli(av(), p(), b)).toBeNull();
    expect(avansEngeli(av(), p(), { ...b, hakedisAcik: false })).toMatch(/modülleri/);
    expect(avansEngeli(av(), p({ gorev: "sekreter" }), b)).toMatch(/öğretmene/);
    expect(avansEngeli(av(), p({ aktif: false }), b)).toMatch(/Pasif/);
    expect(avansEngeli(av(), p(), { ...b, tamKapsam: false })).toMatch(/genel yönetici/);
    expect(avansEngeli(av({ tutar: 0 }), p(), b)).toMatch(/tutarı/);
    expect(avansEngeli(av({ tutar: 1.111 }), p(), b)).toMatch(/tutarı/);
    expect(avansEngeli(av({ subeId: "s2" }), p(), b)).toMatch(/ana şube/);
  });
});

describe("personel kartı doğrulama", () => {
  const dogrula = (x: Partial<Personel>, eski?: Personel) => personelDogrula(personelTemizle(p({ id: "n", telefon: "0532 999 99 99", eposta: "n@b.com", ...x })), eski, kart);
  it("geçerli kart ve temizlik", () => {
    expect(dogrula({})).toBeNull();
    expect(personelTemizle(p({ ad: "  Ayşe   Nur ", telefon: "5321112233", eposta: " ISMAIL@X.com " }))).toMatchObject({ ad: "Ayşe Nur", telefon: "0532 111 22 33", eposta: "ismail@x.com" });
  });
  it.each([
    [{ ad: " " }, /Ad boş/], [{ soyad: "" }, /Soyad boş/], [{ ad: "123" }, /harf/], [{ ad: "a".repeat(61) }, /en fazla/],
    [{ telefon: "123" }, /telefon/], [{ eposta: "x@" }, /e-posta/], [{ gorev: "patron" as never }, /görev/],
    [{ subeIds: [] }, /şube/], [{ subeIds: ["s1", "s1"] }, /yinelenen/], [{ subeIds: ["sX"], anaSubeId: "sX" }, /tanımsız/], [{ subeIds: ["s2"], anaSubeId: "s2" }, /Pasif/], [{ anaSubeId: "s9" }, /Ana şube/],
    [{ dersIds: ["l9"] }, /tanımsız ders/], [{ baslangic: "2026-02-31" }, /tarihi/], [{ dersUcreti: -1 }, /Ücret/], [{ telefon: "0532 000 00 01" }, /başka bir personel/], [{ eposta: "X@Y.COM" }, /başka bir personel/],
  ] as [Partial<Personel>, RegExp][])("reddeder: %j", (x, m) => expect(dogrula(x)).toMatch(m));
  it("değişmeyen eski alan kilitlemez (telefonsuz kurulum yöneticisi)", () => {
    const eski = p({ id: "n", telefon: "", eposta: "" });
    expect(personelDogrula(personelTemizle({ ...eski, ad: "Yeni" }), eski, kart)).toBeNull();
  });
  it("e-posta boş olabilir; ücret tipi geçerli olmalı", () => {
    expect(dogrula({ eposta: "" })).toBeNull();
    expect(ucretEngeli({ ucretTipi: "x" as never, dersUcreti: 0, sabitUcret: 0 })).toMatch(/tipi/);
  });
});

describe("kart yetkisi", () => {
  const m = { rol: "sube-muduru" as const, personelId: "m" };
  it("yetki yükseltme ve üst kart", () => {
    expect(kartYetkiEngeli(p({ gorev: "genel-yonetici" }), p(), m)).toMatch(/Genel yönetici/);
    expect(kartYetkiEngeli(p({ gorev: "genel-yonetici" }), p({ gorev: "genel-yonetici" }), m)).toMatch(/yetkili/);
  });
  it("kişi kendi görevini, şubesini, ücretini değiştiremez; iletişimini değiştirir", () => {
    const ben = p({ id: "m", gorev: "sube-muduru" });
    expect(kartYetkiEngeli({ ...ben, gorev: "sekreter" }, ben, m)).toMatch(/görevinizi/);
    expect(kartYetkiEngeli({ ...ben, subeIds: ["s1", "s2"] }, ben, m)).toMatch(/şube/);
    expect(kartYetkiEngeli({ ...ben, sabitUcret: 9 }, ben, m)).toMatch(/ücret/);
    expect(kartYetkiEngeli({ ...ben, telefon: "0532 000 00 02" }, ben, m)).toBeNull();
  });
});

describe("dersi olan öğretmen", () => {
  it("kapanmış satır açık sayılmaz; bugün biten açık sayılır", () => {
    expect(acikProgram([satir({ bitis: "2026-11-08" }), satir({ id: "b", bitis: BUGUN }), satir({ id: "c" })], "t", BUGUN).map((x) => x.id)).toEqual(["b", "c"]);
  });
  it("açık ders veya planlı etüt varken pasife alınamaz", () => {
    expect(pasifeAlmaEngeli("t", atama({ program: [satir()] }), BUGUN)).toMatch(/1 dersi/);
    expect(pasifeAlmaEngeli("t", atama({ randevular: [r({ durum: "planli", tarih: "2026-11-10" })] }), BUGUN)).toMatch(/etüt/);
    expect(pasifeAlmaEngeli("t", atama({ randevular: [r({ durum: "yapildi", tarih: "2026-11-01" })], program: [satir({ bitis: "2026-11-01" })] }), BUGUN)).toBeNull();
  });
  it("yaklaşan yedek görevi varken pasife alınamaz", () => {
    expect(pasifeAlmaEngeli("t", atama({ yedekAtamalari: [{ oturumId: "pr_2026-11-10", ogretmenId: "t", atayan: "", zaman: "" }] }), BUGUN)).toMatch(/yedek/);
  });
  it("görev değişimi ve dersi olan şubeden çıkarma engellenir; dersi olmayan şubeden çıkarılır", () => {
    const iki = p({ subeIds: ["s1", "s2"] });
    const d = atama({ program: [satir({ grupId: "g2" })] });
    expect(atamaEngeli({ ...iki, gorev: "sekreter" }, iki, d, BUGUN)).toMatch(/görevi/);
    expect(atamaEngeli({ ...iki, subeIds: ["s1"] }, iki, d, BUGUN)).toMatch(/şubeden/);
    expect(atamaEngeli({ ...iki, subeIds: ["s2"], anaSubeId: "s2" }, iki, d, BUGUN)).toBeNull();
  });
});

describe("silme", () => {
  const bos = { program: [], randevular: [], gruplar: [], yoklamalar: {}, musaitlikler: [], avanslar: [], hakedisDurum: {}, odevler: [] } as unknown as Parameters<typeof personelSilmeEngeli>[1];
  it("bağlı kayıt yoksa silinir", () => expect(personelSilmeEngeli("t", bos)).toBeNull());
  it.each([
    ["program", { program: [satir()] }], ["yoklama", { yoklamalar: yok(y("a")) }], ["randevu", { randevular: [r()] }], ["müsaitlik", { musaitlikler: [{ ogretmenId: "t" }] }],
    ["avans", { avanslar: [av()] }], ["rehber", { gruplar: [{ id: "g", rehberId: "t" }] }], ["ödev", { odevler: [{ ogretmenId: "t" }] }], ["hak ediş", { hakedisDurum: { "2026-10_t": "odendi" } }],
  ])("%s varken silinemez", (_ad, x) => expect(personelSilmeEngeli("t", { ...bos, ...x } as never)).toMatch(/pasife/));
});

describe("kişisel ve ücret verisi", () => {
  const mudur: Goren = { rol: "sube-muduru", personelId: "m", yetki13: true };
  const sekreter: Goren = { rol: "sekreter", personelId: "k", yetki13: false };
  const genel: Goren = { rol: "genel-yonetici", personelId: "g", yetki13: true };
  it("ücret: müdür yalnızca alt görevdekini görür", () => {
    expect(ucretGorur(mudur, p())).toBe(true);
    expect(ucretGorur(mudur, p({ gorev: "sube-muduru" }))).toBe(false);
    expect(ucretGorur(mudur, p({ gorev: "genel-yonetici" }))).toBe(false);
    expect(ucretGorur(mudur, p({ id: "m", gorev: "sube-muduru" }))).toBe(true);
    expect(ucretGorur(genel, p({ gorev: "genel-yonetici" }))).toBe(true);
    expect(ucretGorur(sekreter, p())).toBe(false);
  });
  it("maskeleme: sekreter iletişim ve ücret göremez; kendi kartını görür", () => {
    const x = p({ ucretTipi: "karma", sabitUcret: 9, dersUcreti: 5 });
    expect(personelMaskele(x, sekreter)).toMatchObject({ telefon: "", eposta: "", ucretTipi: "sabit", sabitUcret: 0, dersUcreti: 0 });
    expect(personelMaskele(x, { ...sekreter, personelId: "t" })).toEqual(x);
  });
  it("maskeli alan yazarken eski değerle korunur", () => {
    const eski = p({ gorev: "sube-muduru", sabitUcret: 9000 });
    expect(maskeliAlanlariKoru({ ...eski, sabitUcret: 0, ad: "Yeni" }, eski, mudur)).toMatchObject({ sabitUcret: 9000, ad: "Yeni" });
    expect(maskeliAlanlariKoru(p({ sabitUcret: 5, gorev: "sube-muduru" }), undefined, mudur)).toMatchObject({ sabitUcret: 0 });
  });
});
