/**
 * Bölüm 12: raporlar sunucunun süzdüğü veriyle (okumaSuz) rol ve şubeye göre sınanır.
 * Tarih sabit parametredir; örnek verinin kendi tarihlerine bağlı doğrulama yapılmaz.
 */
import { describe, expect, it } from "vitest";
import { ornekVeriUret, sube, type Db, type Rol } from "@/data/model";
import { bolumYetkisi } from "@/bolumler/02-kullanicilar/kurallar";
import { okumaSuz, type Aktor } from "../../../server/politika";
import { raporCsv, raporListesi, raporlar, type RaporBaglami } from "./raporTanimlari";

const BUGUN = "2030-03-15";
const ham = ornekVeriUret();
const FINANS: Db = {
  ...structuredClone(ham),
  moduller: { ...ham.moduller, finans: true },
  giderler: [
    { id: "gm", tarih: "2030-03-01", subeId: "merkez", kategori: "Kira", aciklama: "Merkez", tutar: 50, kasa: "banka", iptal: null },
    { id: "g1", tarih: "2030-03-02", subeId: "s1", kategori: "Fatura", aciklama: "Su", tutar: 20, kasa: "nakit", iptal: { neden: "hata", kullanici: "x", zaman: "2030-03-03T10:00" } },
    { id: "g2", tarih: "2030-03-02", subeId: "s2", kategori: "Fatura", aciklama: "Gaz", tutar: 30, kasa: "nakit", iptal: null },
  ],
  tahsilatlar: [
    { id: "th", makbuzNo: "M1", zaman: "2030-03-04T10:00", veliId: "v", subeId: "s1", alinanSubeId: "s1", tutar: 100, yontem: "nakit", dagilim: [], iptal: { neden: "yanlış", kullanici: "x", zaman: "2030-03-05T10:00" }, kullanici: "x" },
  ],
  virmanlar: [],
  iadeler: [{ id: "ia", makbuzNo: "I1", zaman: "2030-03-06T10:00", kayitId: "k", ogrenciId: "o", veliId: "v", subeId: "s1", yontem: "nakit", tutar: 15, kullanici: "x", iptal: null }],
  islemler: [
    { id: "i1", zaman: "2030-03-01T10:00", kullanici: "x", islem: "Tahsilat", detay: "1.000 TL", subeId: "s1" },
    { id: "i2", zaman: "2030-03-01T10:00", kullanici: "x", islem: "Kayıt iptali", detay: "x", subeId: "s1" },
  ],
};

const aktor = (kullaniciId: string, d: Db = FINANS): Aktor => {
  const kullanici = d.kullanicilar.find((k) => k.id === kullaniciId)!;
  return { kullanici, personel: d.personel.find((p) => p.id === kullanici.personelId)! };
};
const sekreterId = FINANS.kullanicilar.find((k) => k.rol === "sekreter" && k.subeIds !== "all" && k.subeIds.includes("s1"))!.id;
const YONETICI = aktor("u0");
const MUDUR = aktor("u1"); // yalnızca s1
const SEKRETER = aktor(sekreterId);

const yetkiOf = (d: Db, rol: Rol) => (kod: string) => bolumYetkisi(d.rolYetkileri, rol, kod);
const anahtarlar = (d: Db, a: Aktor) => raporListesi(d.moduller, a.kullanici.rol, yetkiOf(d, a.kullanici.rol)).map((r) => r.key);
const baglam = (sg: RaporBaglami["sg"], merkezDahil = false): RaporBaglami => ({ sg, sezonId: FINANS.sezonlar.find((s) => s.aktif)!.id, bugun: BUGUN, merkezDahil });
const rapor = (key: string) => raporlar.find((r) => r.key === key)!;
const yalnizS1 = (s: string | null | undefined) => s === "s1";

describe("rapor listesi", () => {
  it("finans raporları yalnızca yönetici ve müdür", () => {
    for (const a of [YONETICI, MUDUR]) expect(anahtarlar(FINANS, a)).toEqual(expect.arrayContaining(["borc", "geciken", "kasa"]));
    expect(anahtarlar(FINANS, SEKRETER)).not.toEqual(expect.arrayContaining(["borc"]));
    expect(anahtarlar(FINANS, SEKRETER)).not.toContain("kasa");
  });
  it("finans modülü kapalıyken finans raporu yok", () => {
    const d = { ...FINANS, moduller: { ...FINANS.moduller, finans: false } };
    expect(anahtarlar(d, YONETICI)).not.toContain("kasa");
  });
  it("yetkisi kaldırılan bölümün raporu çıkmaz", () => {
    const l = raporListesi(FINANS.moduller, "sube-muduru", (k) => k !== "04" && k !== "10").map((r) => r.key);
    expect(l).not.toContain("ogrenci");
    expect(l).not.toContain("mesaj");
  });
  it("hiç yetki yoksa yalnızca kişisel veri içermeyen rapor kalır", () => {
    expect(raporListesi({}, "sekreter", () => false).map((r) => r.key)).toEqual(["doluluk"]);
  });
});

describe("şube süzmesi (sunucu verisiyle)", () => {
  const veri = okumaSuz(FINANS, MUDUR, BUGUN);
  const digerSube = sube("s2")!.ad;
  const sezonluRaporlar = ["ogrenci", "doluluk", "devamsizlik", "borc", "geciken", "mesaj"];
  it.each(sezonluRaporlar)("müdür %s raporunda başka şube görmez", (key) => {
    const s = rapor(key).uret(veri, baglam(yalnizS1));
    expect(s.satirlar.map((r) => r[s.subeSutun])).not.toContain(digerSube);
  });
  it("yönetici başka şubeyi seçmişse rapor o şubeyle sınırlı", () => {
    const y = okumaSuz(FINANS, YONETICI, BUGUN);
    const s = rapor("ogrenci").uret(y, baglam(yalnizS1));
    expect(s.satirlar.length).toBeGreaterThan(0);
    expect(s.satirlar.every((r) => r[1] === sube("s1")!.ad)).toBe(true);
  });
});

describe("kasa raporu", () => {
  const y = okumaSuz(FINANS, YONETICI, BUGUN);
  it("iptal ters kayıtla, iade çıkış olarak yer alır", () => {
    const s = rapor("kasa").uret(y, baglam(yalnizS1));
    const tur = s.satirlar.map((r) => r[2]);
    expect(tur).toEqual(expect.arrayContaining(["Tahsilat", "Tahsilat iptali", "Gider", "Gider iptali", "İade"]));
    const toplam = s.satirlar.reduce((t, r) => t + Number(r[4]) - Number(r[5]), 0);
    expect(toplam).toBe(-15); // yalnızca iptal edilmemiş iade kalır
  });
  it("Genel Merkez: tek şube görünümünde ve müdüre yok, tüm şubelerde yöneticide var", () => {
    expect(rapor("kasa").uret(y, baglam(yalnizS1)).satirlar.some((r) => r[1] === "Genel Merkez")).toBe(false);
    expect(rapor("kasa").uret(y, baglam(() => true, true)).satirlar.some((r) => r[1] === "Genel Merkez")).toBe(true);
    expect(rapor("kasa").uret(okumaSuz(FINANS, MUDUR, BUGUN), baglam(yalnizS1, false)).satirlar.some((r) => r[1] === "Genel Merkez")).toBe(false);
  });
});

describe("kasa raporu tarih aralığı", () => {
  const y = okumaSuz(FINANS, YONETICI, BUGUN);
  const uret = (bas?: string, bit?: string) => rapor("kasa").uret(y, { ...baglam(yalnizS1), bas, bit });
  it("varsayılan: aralıksız sonuç aynı kalır", () => {
    expect(uret().satirlar).toEqual(uret("", "").satirlar);
    expect(uret().satirlar.length).toBeGreaterThanOrEqual(5);
  });
  it("aslı aralık dışında kalan iptalin ters kaydı kendi gününde görünür", () => {
    const s = uret("2030-03-05", "2030-03-05");
    expect(s.satirlar.map((r) => r[2])).toEqual(["Tahsilat iptali"]);
    expect(s.satirlar[0].slice(4)).toEqual([0, 100]);
  });
  it("aslı ve iptali aynı aralıktaysa net sıfır", () => {
    const s = uret("2030-03-04", "2030-03-05");
    expect(s.satirlar.reduce((t, r) => t + Number(r[4]) - Number(r[5]), 0)).toBe(0);
  });
  it("başlangıç bitişten sonraysa satır yok; dışa aktarma da boş", () => {
    const s = uret("2030-03-31", "2030-03-01");
    expect(s.satirlar).toEqual([]);
    expect(raporCsv(s).split("\r\n")).toHaveLength(1);
  });
  it("dışa aktarma aralığa uyar", () => {
    const metin = raporCsv(uret("2030-03-06", "2030-03-06"));
    expect(metin).toContain("I1");
    expect(metin).not.toContain("M1");
  });
});

describe("devamsızlık ve katılım", () => {
  const d = structuredClone(FINANS);
  const sezonId = d.sezonlar.find((s) => s.aktif)!.id;
  const k = d.kayitlar.find((x) => x.sezonId === sezonId && x.durum === "aktif")!;
  const eskiSezon = d.sezonlar.find((s) => s.id !== sezonId)?.id ?? "yok";
  d.gruplar.push({ ...d.gruplar.find((g) => g.id === k.grupId)!, id: "eskiGrup", sezonId: eskiSezon });
  d.kayitlar.push({ ...k, id: "eskiKayit", sezonId: eskiSezon, grupId: "eskiGrup" });
  d.yoklamalar = {
    a: { oturumId: "a", tarih: "2030-03-01", satirId: "x", grupId: k.grupId, ogretmenId: "x", durumlar: { [k.ogrenciId]: "gelmedi", b: "izinli", c: "geldi" }, konu: "", kayitZamani: "" },
    e: { oturumId: "e", tarih: "2020-03-01", satirId: "x", grupId: "eskiGrup", ogretmenId: "x", durumlar: { [k.ogrenciId]: "geldi" }, konu: "", kayitZamani: "" },
  };
  const b = { ...baglam(() => true), sezonId };
  it("eski sezon kaydı ve yoklaması rapora girmez", () => {
    const satirlar = rapor("devamsizlik").uret(d, b).satirlar;
    const ogr = d.ogrenciler.find((o) => o.id === k.ogrenciId)!;
    const benim = satirlar.filter((r) => r[0] === `${ogr.ad} ${ogr.soyad}`.trim());
    expect(benim).toHaveLength(1);
    expect(benim[0].slice(3)).toEqual([1, 1, 0, 0, 100]);
  });
  it("katılımda izinli paydaya girmez", () => {
    const s = rapor("dersKayit").uret(d, b).satirlar.find((r) => r[0] === "2030-03-01")!;
    expect(s[6]).toBe("1/2");
  });
  it("öğrencisi silinmiş kayıt raporu düşürmez", () => {
    const x = structuredClone(d);
    x.ogrenciler = [];
    expect(() => rapor("ogrenci").uret(x, b)).not.toThrow();
    expect(() => rapor("devamsizlik").uret(x, b)).not.toThrow();
  });
});

describe("sınır durumlar", () => {
  it("kapasitesi sıfır grup: Infinity yok", () => {
    const d = structuredClone(FINANS);
    d.gruplar = d.gruplar.map((g) => ({ ...g, kapasite: 0 }));
    const s = rapor("doluluk").uret(d, baglam(() => true));
    expect(s.satirlar.every((r) => r[5] === 0)).toBe(true);
  });
  it("boş kurulumda tüm raporlar boş döner", () => {
    const d = { ...structuredClone(FINANS), gruplar: [], kayitlar: [], ogrenciler: [], veliler: [], yoklamalar: {}, adaylar: [], odevler: [], gonderimler: [], taksitler: [], tahsilatlar: [], giderler: [], virmanlar: [], iadeler: [] } as Db;
    for (const r of raporlar) expect(r.uret(d, baglam(() => true)).satirlar).toEqual([]);
  });
  it("CSV'de veli adından formül çalışmaz", () => {
    const metin = raporCsv({ basliklar: ["Ad", "Tutar"], satirlar: [["=HYPERLINK(1)", 12.5]] });
    expect(metin).toContain("'=HYPERLINK(1);12,5");
  });
});

describe("okumaSuz · işlem kaydı", () => {
  it("finans görmeyene tutarlı işlem gitmez; görene gider", () => {
    const kapali = { ...FINANS, moduller: { ...FINANS.moduller, finans: false } };
    const l = okumaSuz(kapali, MUDUR, BUGUN).islemler.map((i) => i.id);
    expect(l).toContain("i2");
    expect(l).not.toContain("i1");
    expect(okumaSuz(FINANS, MUDUR, BUGUN).islemler.map((i) => i.id)).toContain("i1");
  });
});
