/** Bölüm 07 saf kuralları: tarihler sabittir, gerçek saate bağlı değildir. */
import { describe, expect, it } from "vitest";
import type { Db, Gonderim, Kayit, Ogrenci, Yoklama } from "../../data/model";
import {
  GEC_YOKLAMA_GUN,
  devamsizlikOlayi,
  devamsizlikYineleniyor,
  duzeltmePlani,
  durumGecerli,
  ilkDurumlar,
  izinEngeli,
  kaldirilanGelmeyenler,
  kayitGrubu,
  oturumBildirimleri,
  tarihMetni,
  oturumDurumu,
  raporBaslangici,
  yeniGelmeyenler,
  yoklamaListesi,
  yoklamaOgrencileri,
  yoklamaOturumu,
  yoklamaYazmaEngeli,
  yoklamaZamanEngeli,
  type YazmaBaglami,
} from "./kurallar";

const BUGUN = "2026-11-09"; // pazartesi
const kayit = (id: string, p: Partial<Kayit> = {}): Kayit => ({ id: `k-${id}`, ogrenciId: id, grupId: "g1", tarih: "2026-09-01", durum: "aktif", grupGecmisi: [{ grupId: "g1", tarih: "2026-09-01" }], ...p }) as Kayit;
const ogr = (id: string, ad = id): Ogrenci => ({ id, ad }) as Ogrenci;

const veri = {
  program: [{ id: "ps1", grupId: "g1", gun: 1, saatId: "h1", dersId: "l1", ogretmenId: "p4", derslikId: "d1", baslangic: "2026-09-07", bitis: "2026-12-28" }],
  gruplar: [{ id: "g1", subeId: "s1", sezonId: "z" }],
  dersSaatleri: [{ id: "h1", baslangic: "16:00", bitis: "16:40" }],
  sezonlar: [{ id: "z", baslangic: "2026-09-01", bitis: "2026-12-20" }],
  iptaller: [{ oturumId: "ps1_2026-11-16", neden: "x", tarih: BUGUN }],
  tatiller: [{ id: "t", tarih: "2026-11-02", ad: "Tatil", subeId: "s1" }],
  kayitlar: [kayit("a"), kayit("b", { durum: "dondurulmus" }), kayit("c", { durum: "iptal" }), kayit("d", { durum: "mezun" }), kayit("e", { grupId: "g2", grupGecmisi: [{ grupId: "g1", tarih: "2026-09-01" }, { grupId: "g2", tarih: "2026-11-05" }] })],
  ogrenciler: ["a", "b", "c", "d", "e"].map((x) => ogr(x)),
  izinler: [],
} as unknown as Db;

const oturum = (tarih: string) => `ps1_${tarih}`;
const yok = (tarih: string, p: Partial<Yoklama> = {}): Yoklama => ({ oturumId: oturum(tarih), tarih, satirId: "ps1", grupId: "g1", ogretmenId: "p4", durumlar: { a: "geldi" }, konu: "", kayitZamani: "", ...p });
const OGRETMEN: YazmaBaglami = { rol: "ogretmen", personelId: "p4", bugun: BUGUN, simdi: "17:00" };
const MUDUR: YazmaBaglami = { rol: "sube-muduru", personelId: "p1", bugun: BUGUN, simdi: "17:00" };

describe("oturumun gerçekliği", () => {
  it("program satırı, gün, yürürlük ve sezon denetlenir", () => {
    expect(yoklamaOturumu(veri, oturum(BUGUN))?.bas).toBe("16:00");
    expect(yoklamaOturumu(veri, "yok_2026-11-09")).toBeNull();
    expect(yoklamaOturumu(veri, oturum("2026-11-10"))).toBeNull(); // salı
    expect(yoklamaOturumu(veri, oturum("2026-08-31"))).toBeNull(); // satır başlamadan
    expect(yoklamaOturumu(veri, oturum("2026-12-21"))).toBeNull(); // sezon sonrası
    expect(yoklamaOturumu(veri, "bozuk")).toBeNull();
  });
  it("tatil ve iptal bilgisi döner", () => {
    expect(yoklamaOturumu(veri, oturum("2026-11-02"))?.tatil?.ad).toBe("Tatil");
    expect(yoklamaOturumu(veri, oturum("2026-11-16"))?.iptal?.neden).toBe("x");
  });
});

describe("yoklamadaki öğrenciler", () => {
  it("kaydın grubu tarihe göre bulunur", () => {
    const k = kayit("x", { grupId: "g3", grupGecmisi: [{ grupId: "g1", tarih: "2026-09-10" }, { grupId: "g2", tarih: "2026-10-01" }, { grupId: "g3", tarih: "2026-10-01" }] });
    expect(kayitGrubu(k, "2026-09-09")).toBeNull();
    expect(kayitGrubu(k, "2026-09-30")).toBe("g1");
    expect(kayitGrubu(k, "2026-10-01")).toBe("g3");
    expect(kayitGrubu(kayit("y", { grupGecmisi: [] }), "2026-08-01")).toBeNull();
    expect(kayitGrubu(kayit("y", { grupGecmisi: [] }), "2026-09-01")).toBe("g1");
  });
  it("yalnızca o tarihte grupta olan aktif kayıtlar", () => {
    expect(yoklamaOgrencileri(veri, "g1", BUGUN).map((o) => o.id)).toEqual(["a"]);
    expect(yoklamaOgrencileri(veri, "g1", "2026-11-02").map((o) => o.id)).toEqual(["a", "e"]);
    expect(yoklamaOgrencileri(veri, "g2", BUGUN).map((o) => o.id)).toEqual(["e"]);
  });
  it("düzeltmede sonradan ayrılan öğrenci listede kalır", () => {
    expect(yoklamaListesi(veri, "g1", BUGUN, { durumlar: { a: "geldi", b: "gelmedi" } }).map((o) => o.id)).toEqual(["a", "b"]);
  });
  it("ilk durum: kayıtlı, sonra izinli, sonra geldi", () => {
    expect(ilkDurumlar(["a", "b", "c"], new Set(["b", "c"]), { durumlar: { c: "gelmedi" } })).toEqual({ a: "geldi", b: "izinli", c: "gelmedi" });
  });
});

describe("kim, ne zaman", () => {
  const z = (tarih: string, rol: YazmaBaglami["rol"], kayitVar = false, simdi = "17:00") => yoklamaZamanEngeli({ tarih, bas: "16:00", kayitVar, rol, bugun: BUGUN, simdi });
  it("gelecek ve başlamamış ders herkese kapalı", () => {
    expect(z("2026-11-16", "genel-yonetici")).toMatch(/Gelecek/);
    expect(z(BUGUN, "genel-yonetici", false, "15:59")).toMatch(/başlamadan/);
    expect(z(BUGUN, "ogretmen", false, "16:00")).toBeNull();
  });
  it("aynı gün düzeltme serbest, geçmişi yalnızca yönetici düzeltir", () => {
    expect(z(BUGUN, "ogretmen", true)).toBeNull();
    expect(z("2026-11-02", "ogretmen", true)).toMatch(/yalnızca yönetici/);
    expect(z("2026-11-02", "sekreter", true)).toMatch(/yalnızca yönetici/);
    expect(z("2026-11-02", "sube-muduru", true)).toBeNull();
    expect(z("2026-09-07", "genel-yonetici", true)).toBeNull();
  });
  it("alınmamış yoklama sınırlı süre geç girilir", () => {
    const sinir = "2026-11-02";
    expect(GEC_YOKLAMA_GUN).toBe(7);
    expect(z(sinir, "ogretmen")).toBeNull();
    expect(z("2026-11-01", "ogretmen")).toMatch(/7 günden eski/);
    expect(z("2026-10-01", "sube-muduru")).toBeNull();
  });
});

describe("yazma denetimi", () => {
  const e = (y: Yoklama, b = OGRETMEN, eski?: Yoklama) => yoklamaYazmaEngeli(y, eski, veri, b);
  it("geçerli yoklama", () => expect(e(yok(BUGUN))).toBeNull());
  it("oturum kimliği ile alanlar uyuşmalı", () => {
    expect(e(yok(BUGUN, { tarih: "2026-11-02" }))).toMatch(/oturumu hatalı/);
    expect(e(yok(BUGUN, { satirId: "ps9" }))).toMatch(/oturumu hatalı/);
    expect(e(yok(BUGUN, { grupId: "g2" }))).toMatch(/oturumu hatalı/);
  });
  it("olmayan ders, tatil, iptal", () => {
    expect(e(yok("2026-11-10", { oturumId: oturum("2026-11-10") }))).toMatch(/böyle bir ders yok/);
    expect(e(yok("2026-11-02"), MUDUR)).toMatch(/tatil/);
    expect(e(yok("2026-11-16"), { ...MUDUR, bugun: "2026-11-17" })).toMatch(/İptal/);
  });
  it("öğretmen yalnızca kendi dersi", () => expect(e(yok(BUGUN), { ...OGRETMEN, personelId: "p7" })).toMatch(/kendi dersinizin/));
  it("geçersiz durum değeri", () => {
    expect(e(yok(BUGUN, { durumlar: { a: "belki" as never } }))).toMatch(/Geçersiz/);
    expect(e(yok(BUGUN, { durumlar: [] as never }))).toMatch(/hatalı/);
    expect(durumGecerli("gec")).toBe(true);
    expect(durumGecerli("toString")).toBe(false);
  });
  it("kaydı olmayan, dondurulmuş, iptal, mezun, nakil olan yazılamaz", () => {
    for (const id of ["zz", "b", "c", "d", "e"]) expect(e(yok(BUGUN, { durumlar: { a: "geldi", [id]: "geldi" } })), id).toMatch(/kaydı olmayan/);
  });
  it("düzeltmede eski yoklamadaki öğrenci kabul edilir", () => {
    const eski = yok(BUGUN, { durumlar: { a: "geldi", b: "gelmedi" } });
    expect(e(yok(BUGUN, { durumlar: { b: "geldi" } }), OGRETMEN, eski)).toBeNull();
  });
  it("boş yoklama ve uzun konu", () => {
    expect(e(yok(BUGUN, { durumlar: {} }))).toMatch(/öğrenci yok/);
    expect(e(yok(BUGUN, { konu: "x".repeat(201) }))).toMatch(/Konu/);
  });
});

describe("devamsızlık bildirimi", () => {
  const g = (p: Partial<Gonderim> = {}) => ({ olay: "devamsizlik", veliId: "v", ogrenciId: "a", metin: "m", zaman: `${BUGUN}T16:10`, ...p }) as Gonderim;
  it("yalnızca yeni gelmedi", () => {
    expect(yeniGelmeyenler({ a: "gelmedi", b: "gelmedi", c: "geldi" }, { a: "gelmedi", b: "geldi", c: "gelmedi" })).toEqual(["b"]);
    expect(yeniGelmeyenler({ a: "gelmedi" })).toEqual(["a"]);
  });
  it("olay: dersin günü, 7 günlük pencere, daha eski", () => {
    expect(devamsizlikOlayi(BUGUN, BUGUN)).toBe("devamsizlik");
    expect(devamsizlikOlayi("2026-11-02", BUGUN)).toBe("devamsizlikGecmis");
    expect(devamsizlikOlayi("2026-11-01", BUGUN)).toBeNull();
    expect(devamsizlikOlayi("2026-11-16", BUGUN)).toBeNull();
    expect(tarihMetni("2026-11-02")).toBe("02.11.2026");
  });
  it("tarihli mesaj başka gün de yinelenmez", () => {
    expect(devamsizlikYineleniyor(g({ olay: "devamsizlikGecmis", zaman: "2026-11-20T10:00" }), [g({ olay: "devamsizlikGecmis" })])).toBe(true);
  });
  it("kaldırılan gelmedi: yalnızca yeni yoklamada durumu değişenler", () => {
    expect(kaldirilanGelmeyenler({ a: "geldi", b: "gelmedi", c: "izinli" }, { a: "gelmedi", b: "gelmedi", c: "gelmedi", d: "gelmedi" })).toEqual(["a", "c"]);
  });
  it("oturum bildirimi kimlikle, eski kayıt gün ve saatle eşleşir", () => {
    const l = [g({ id: "1", oturumId: "o1" }), g({ id: "2", oturumId: "o2" }), g({ id: "3", metin: "16:00 ders" }), g({ id: "4", metin: "18:00 ders" }), g({ id: "5", olay: "duyuru", oturumId: "o1" })];
    expect(oturumBildirimleri(l, "o1", BUGUN, "a", "16:00").map((x) => x.id)).toEqual(["1", "3"]);
  });
  it("düzeltme planı: gitmemiş silinir, giden veliye bir kez", () => {
    const l = [g({ id: "1", veliId: "v1", durum: "bekliyor" }), g({ id: "2", veliId: "v2", durum: "iletildi" }), g({ id: "3", veliId: "v3", durum: "okundu" }), g({ id: "4", veliId: "v4", durum: "basarisiz" })];
    expect(duzeltmePlani(l, [])).toEqual({ silinecek: ["1", "4"], veliler: ["v2", "v3"] });
    expect(duzeltmePlani(l, [{ veliId: "v2" }]).veliler).toEqual(["v3"]);
  });
  it("aynı gün aynı metin yinelenmez; başka gün, veli, metin yinelenme sayılmaz", () => {
    expect(devamsizlikYineleniyor(g({ zaman: `${BUGUN}T18:00` }), [g()])).toBe(true);
    expect(devamsizlikYineleniyor(g({ zaman: "2026-11-16T16:10" }), [g()])).toBe(false);
    expect(devamsizlikYineleniyor(g({ veliId: "w" }), [g()])).toBe(false);
    expect(devamsizlikYineleniyor(g({ metin: "n" }), [g()])).toBe(false);
    expect(devamsizlikYineleniyor(g({ olay: "duyuru" }), [g()])).toBe(false);
  });
});

describe("veli izni", () => {
  const d = { ...veri, tatiller: [{ id: "t", tarih: "2026-12-07", ad: "Tatil", subeId: null }], kayitlar: [kayit("a"), kayit("b", { durum: "dondurulmus" })], izinler: [{ ogrenciId: "a", tarih: "2026-11-23" }] } as unknown as Db;
  it("tarih geçerli ve aralıkta olmalı", () => {
    expect(izinEngeli({ ogrenciId: "a", tarih: "2026-11-30" }, d, BUGUN)).toBeNull();
    for (const t of ["2026-13-45", "2026-11-08", "2027-02-01", 5]) expect(izinEngeli({ ogrenciId: "a", tarih: t }, d, BUGUN), String(t)).toMatch(/Geçersiz/);
  });
  it("aktif kayıt gerekir", () => expect(izinEngeli({ ogrenciId: "b", tarih: "2026-11-30" }, d, BUGUN)).toMatch(/aktif kaydı/));
  it("dersi olmayan, tatil ve iptal gününe izin yazılmaz", () => {
    for (const t of ["2026-11-24", "2026-12-07", "2026-11-16"]) expect(izinEngeli({ ogrenciId: "a", tarih: t }, d, BUGUN), t).toMatch(/ders yok/);
  });
  it("aynı gün ikinci izin yazılmaz", () => expect(izinEngeli({ ogrenciId: "a", tarih: "2026-11-23" }, d, BUGUN)).toMatch(/zaten/));
});

describe("ekran yardımcıları", () => {
  const o = (p = {}) => ({ tarih: BUGUN, bas: "16:00", iptal: null, tatil: null, ...p });
  it("oturum durumu", () => {
    expect(oturumDurumu(o({ tatil: {} }), true, BUGUN, "17:00", 15)).toBe("iptal");
    expect(oturumDurumu(o(), true, BUGUN, "17:00", 15)).toBe("alindi");
    expect(oturumDurumu(o({ tarih: "2026-11-02" }), false, BUGUN, "17:00", 15)).toBe("gecikti");
    expect(oturumDurumu(o({ tarih: "2026-11-16" }), false, BUGUN, "17:00", 15)).toBe("planli");
    expect(oturumDurumu(o(), false, BUGUN, "16:15", 15)).toBe("gecikti");
    expect(oturumDurumu(o(), false, BUGUN, "16:05", 15)).toBe("devam");
    expect(oturumDurumu(o(), false, BUGUN, "15:00", 15)).toBe("planli");
  });
  it("rapor başlangıcı sezon tanımından gelir", () => {
    expect(raporBaslangici("hafta", "2026-11-11")).toBe(BUGUN);
    expect(raporBaslangici("ay", BUGUN)).toBe("2026-11-01");
    expect(raporBaslangici("sezon", BUGUN, "2027-09-06")).toBe("2027-09-06");
    expect(raporBaslangici("sezon", BUGUN)).toBe("2026-11-01");
  });
});
