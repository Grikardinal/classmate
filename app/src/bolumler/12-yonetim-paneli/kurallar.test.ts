/** Bölüm 12 saf hesapları. Tarihler parametreyle verilir; gerçek saate bağlı değildir. */
import { describe, expect, it } from "vitest";
import type { IslemKaydi, Taksit, Yoklama } from "@/data/model";
import { aylikYeniKayit, csvHucre, finansIslemiMi, finansOzeti, finansPanelGorur, haftaOzeti, kayitOzeti, kontrolBekleyenOdevler, oranYuzde, selamla, seviyeDagilimi, sonAylar, sonIslemler, subeKarsilastirma, yoklamaBekliyor } from "./kurallar";

const BUGUN = "2030-03-15";
const hepsi = () => true;
const yalnizS1 = (s: string | null | undefined) => s === "s1";

const taksit = (p: Partial<Taksit>): Taksit => ({ id: "t", kayitId: "k", ogrenciId: "o", veliId: "v1", subeId: "s1", no: 1, vade: BUGUN, tutar: 100, odenen: 0, ...p }) as Taksit;
const yoklama = (grupId: string, durumlar: Yoklama["durumlar"], oturumId = "y1"): Yoklama => ({ oturumId, tarih: BUGUN, satirId: "p", grupId, ogretmenId: "x", durumlar, konu: "", kayitZamani: "" });
const kayit = (p: object) => ({ id: "k", ogrenciId: "o", sezonId: "z", subeId: "s1", grupId: "g1", durum: "aktif", tarih: "2030-01-10", ...p }) as never;
const grup = (p: object) => ({ id: "g1", subeId: "s1", sezonId: "z", seviye: 5, kapasite: 10, ...p }) as never;

describe("selamla", () => {
  it.each([["08:00", "Günaydın"], ["13:00", "İyi günler"], ["20:00", "İyi akşamlar"], ["23:30", "İyi geceler"], ["03:00", "İyi geceler"], ["05:00", "Günaydın"]])("%s → %s", (s, b) => expect(selamla(s)).toBe(b));
});

describe("sonAylar", () => {
  it("yıl sınırını geçer", () => expect(sonAylar("2030-02-28", 4)).toEqual(["2029-11", "2029-12", "2030-01", "2030-02"]));
  it("ayın son gününde ay atlamaz", () => expect(sonAylar("2030-03-31", 2)).toEqual(["2030-02", "2030-03"]));
  it("aralık ayı", () => expect(sonAylar("2030-12-01", 1)).toEqual(["2030-12"]));
});

describe("finans görünürlüğü", () => {
  it("modül, yetki ve rol birlikte gerekir", () => {
    expect(finansPanelGorur("genel-yonetici", true, true)).toBe(true);
    expect(finansPanelGorur("sube-muduru", true, true)).toBe(true);
    expect(finansPanelGorur("sube-muduru", false, true)).toBe(false);
    expect(finansPanelGorur("sube-muduru", true, false)).toBe(false);
    expect(finansPanelGorur("sekreter", true, true)).toBe(false);
    expect(finansPanelGorur("ogretmen", true, true)).toBe(false);
  });
});

describe("kayitOzeti", () => {
  const d = {
    gruplar: [grup({}), grup({ id: "g2", subeId: "s2" }), grup({ id: "eski", sezonId: "y" })],
    kayitlar: [
      kayit({ id: "a", tarih: "2030-03-01" }),
      kayit({ id: "b" }),
      kayit({ id: "c", durum: "dondurulmus" }),
      kayit({ id: "d", durum: "iptal", tarih: "2030-03-02" }),
      kayit({ id: "e", durum: "mezun" }),
      kayit({ id: "f", sezonId: "y" }),
      kayit({ id: "g", subeId: "s2" }),
    ],
  };
  it("yalnızca aktif sezonun aktif kayıtları", () => {
    const o = kayitOzeti(d, { sezonId: "z", sg: hepsi, bugun: BUGUN });
    expect(o.aktif.map((k) => k.id)).toEqual(["a", "b", "g"]);
    expect(o.kapasite).toBe(20);
    expect(o.doluluk).toBe(15);
    expect(o.buAyYeni).toBe(1);
  });
  it("şube süzmesi", () => {
    const o = kayitOzeti(d, { sezonId: "z", sg: yalnizS1, bugun: BUGUN });
    expect(o.aktif.map((k) => k.id)).toEqual(["a", "b"]);
    expect(o.kapasite).toBe(10);
  });
  it("boş kurulum: sıfıra bölme yok", () => {
    const o = kayitOzeti({ gruplar: [], kayitlar: [] }, { sezonId: "z", sg: hepsi, bugun: BUGUN });
    expect(o.doluluk).toBe(0);
    expect(o.buAyYeni).toBe(0);
  });
});

describe("grafik verileri", () => {
  it("aylık yeni kayıt iptali saymaz, ay sınırı doğru", () => {
    const l = [{ tarih: "2030-02-28", durum: "aktif" }, { tarih: "2030-03-01", durum: "mezun" }, { tarih: "2030-03-02", durum: "iptal" }, { tarih: "2030-03-03", durum: "dondurulmus" }] as never[];
    expect(aylikYeniKayit(l, ["2030-02", "2030-03"])).toEqual([1, 2]);
  });
  it("seviye dağılımı, grubu bulunmayan kayıt sayılmaz", () => {
    const s = seviyeDagilimi([{ grupId: "g1" }, { grupId: "yok" }], [{ id: "g1", seviye: 5 }]);
    expect(s.find((x) => x.seviye === 5)?.adet).toBe(1);
    expect(s.reduce((t, x) => t + x.adet, 0)).toBe(1);
    expect(s).toHaveLength(6);
  });
});

describe("hafta özeti", () => {
  const o = (id: string, tarih: string, bas = "09:00") => ({ id, tarih, bas });
  const y = { a: yoklama("g", { x: "geldi", y: "gelmedi", z: "izinli", w: "geldi" }, "a") };
  it("izinli devamsızlık oranına girmez", () => {
    const h = haftaOzeti([o("a", "2030-03-13")], y, BUGUN, "12:00", 15);
    expect(h.devam.oran).toBeCloseTo(1 / 3);
    expect(oranYuzde(h.devam.oran)).toBe(33.3);
    expect(h.islenen).toBe(1);
  });
  it("yoklaması alınmayan: geçmiş gün veya eşik aşılmış ders", () => {
    const h = haftaOzeti([o("b", "2030-03-14"), o("c", BUGUN, "11:50"), o("d", BUGUN, "11:30")], {}, BUGUN, "12:00", 15);
    expect(h.alinmayan.map((x) => x.id)).toEqual(["b", "d"]);
    expect(h.planlanan).toBe(3);
  });
  it("boş hafta", () => {
    const h = haftaOzeti([], {}, BUGUN, "12:00", 15);
    expect(h.devam.oran).toBe(0);
    expect(h.alinmayan).toEqual([]);
  });
  it("alınmış yoklama beklemez", () => expect(yoklamaBekliyor(o("a", "2030-03-13"), y, BUGUN, "12:00", 15)).toBe(false));
});

describe("kontrol bekleyen ödev", () => {
  const gruplar = [{ id: "g1", sezonId: "z" }, { id: "eski", sezonId: "y" }];
  const o = (p: object) => ({ grupId: "g1", teslim: "2030-03-10", kontrolEdildi: false, ...p });
  it("eski sezon, gelecek teslim ve kontrol edilmişi saymaz", () => {
    const l = [o({}), o({ grupId: "eski" }), o({ teslim: "2030-03-20" }), o({ kontrolEdildi: true })];
    expect(kontrolBekleyenOdevler(l, gruplar, { sezonId: "z", gorunur: hepsi, bugun: BUGUN })).toBe(1);
  });
});

describe("finansOzeti", () => {
  it("bu ay beklenen/tahsil, önceki ay dahil değil", () => {
    const f = finansOzeti([taksit({ vade: "2030-03-01", tutar: 100, odenen: 50 }), taksit({ vade: "2030-03-31", tutar: 100 }), taksit({ vade: "2030-02-28", tutar: 40, odenen: 40 })], BUGUN);
    expect(f.beklenen).toBe(200);
    expect(f.tahsil).toBe(50);
    expect(f.oran).toBe(25);
  });
  it("kuruş toplamı kaymaz", () => {
    const f = finansOzeti([taksit({ vade: "2030-03-01", tutar: 0.1 }), taksit({ vade: "2030-03-02", tutar: 0.2 })], BUGUN);
    expect(f.beklenen).toBe(0.3);
    expect(f.gecikenTutar).toBe(0.3);
  });
  it("geciken: bugün vadeli gecikmiş değil, ödenmiş sayılmaz, veli tekil", () => {
    const f = finansOzeti([
      taksit({ vade: "2030-03-01", veliId: "a", tutar: 100, odenen: 30 }),
      taksit({ vade: "2030-03-02", veliId: "a", tutar: 10 }),
      taksit({ vade: "2030-03-03", veliId: "b", tutar: 50, odenen: 50 }),
      taksit({ vade: BUGUN, veliId: "a", tutar: 10 }),
      taksit({ vade: BUGUN, veliId: "c", tutar: 10 }),
    ], BUGUN);
    expect(f.gecikenTutar).toBe(80);
    expect(f.gecikenVeli).toBe(1);
    expect(f.bugunVeli).toBe(2);
    expect(f.takipVeli).toBe(2);
  });
  it("boş veri", () => expect(finansOzeti([], BUGUN)).toMatchObject({ oran: 0, gecikenTutar: 0, takipVeli: 0 }));
});

describe("şube karşılaştırma", () => {
  const veri = {
    aktif: [{ subeId: "s1" }, { subeId: "s1" }],
    gruplar: [{ id: "g1", subeId: "s1", kapasite: 4 }],
    yoklamalar: { a: yoklama("g1", { x: "gelmedi", y: "geldi" }, "a"), b: yoklama("eski", { x: "gelmedi", y: "gelmedi" }, "b") },
    taksitler: [taksit({ vade: "2030-03-01", tutar: 100, odenen: 40 }), taksit({ vade: "2030-04-01", tutar: 900, odenen: 900 })],
    adaylar: [{ subeId: "s1" }],
  };
  it("sezon dışı yoklama ve gelecek vade girmez", () => {
    expect(subeKarsilastirma(["s1"], veri, BUGUN)[0]).toEqual({ subeId: "s1", ogrenci: 2, doluluk: 50, devamsizlik: 50, tahsilat: 40, acikAday: 1 });
  });
  it("verisi olmayan şubede sıfır", () => {
    expect(subeKarsilastirma(["s9"], veri, BUGUN)[0]).toEqual({ subeId: "s9", ogrenci: 0, doluluk: 0, devamsizlik: 0, tahsilat: 0, acikAday: 0 });
  });
});

describe("son işlemler", () => {
  const i = (id: string, zaman: string, islem: string, subeId: string | null): IslemKaydi => ({ id, zaman, kullanici: "x", islem, detay: "", subeId });
  const l = [i("a", "2030-01-01T10:00", "Kayıt", "s1"), i("b", "2030-01-03T10:00", "Tahsilat", "s1"), i("c", "2030-01-02T10:00", "Kayıt", "s2"), i("d", "2030-01-04T10:00", "Sezon", null)];
  it("yeniden eskiye", () => expect(sonIslemler(l, { sg: hepsi, tumKapsam: true, finans: true }).map((x) => x.id)).toEqual(["d", "b", "c", "a"]));
  it("şube ve kurum geneli süzmesi", () => expect(sonIslemler(l, { sg: yalnizS1, tumKapsam: false, finans: true }).map((x) => x.id)).toEqual(["b", "a"]));
  it("finans görmeyene tutarlı işlem yok", () => expect(sonIslemler(l, { sg: hepsi, tumKapsam: true, finans: false }).map((x) => x.id)).toEqual(["d", "c", "a"]));
  it("adet sınırı", () => expect(sonIslemler(l, { sg: hepsi, tumKapsam: true, finans: true, adet: 1 })).toHaveLength(1));
  it("finans işlem adları", () => {
    expect(finansIslemiMi("Tahsilat iptali")).toBe(true);
    expect(finansIslemiMi("İptal hesabı")).toBe(true);
    expect(finansIslemiMi("Kayıt iptali")).toBe(false);
  });
});

describe("CSV hücresi", () => {
  it.each(["=1+1", "+90 555", "-2+3", "@SUM(A1)", "  =cmd", "\t=1"])("formül etkisizleşir: %j", (s) => expect(csvHucre(s).startsWith("'")).toBe(true));
  it("sıradan metin ve tarih değişmez", () => {
    expect(csvHucre("Ayşe")).toBe("Ayşe");
    expect(csvHucre("2030-03-15")).toBe("2030-03-15");
  });
  it("sayı metin sayılmaz; ondalık virgül", () => {
    expect(csvHucre(-5)).toBe("-5");
    expect(csvHucre(12.5)).toBe("12,5");
  });
  it("satır sonu tek satıra iner; NaN boş", () => {
    expect(csvHucre("a\r\nb")).toBe("a b");
    expect(csvHucre(NaN)).toBe("");
  });
});
