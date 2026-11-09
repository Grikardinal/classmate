/**
 * Bölüm 03'ün sunucu tarafı: server/politika.ts · yazmaDenetle → onKayitDenetle ve okumaSuz (aday görünürlüğü).
 * Veritabanı açılmaz: örnek veri + değişiklik paketi (store.guncelle ile aynı fark hesabı).
 */
import { describe, expect, it } from "vitest";
import { ornekVeriUret, type Aday, type Db } from "@/data/model";
import { farkHesapla, farkUygula, type Degisiklik } from "@/data/fark";
import { YetkiHatasi, okumaSuz, yazmaDenetle, type Aktor } from "../../../server/politika";

const db = ornekVeriUret();
const aktor = (kullaniciId: string, kaynak: Db = db): Aktor => {
  const kullanici = kaynak.kullanicilar.find((k) => k.id === kullaniciId)!;
  return { kullanici, personel: kaynak.personel.find((p) => p.id === kullanici.personelId)! };
};
const YONETICI = aktor("u0");
const GUL = aktor("u9"); // sekreter · s1
const MURAT = aktor("u2"); // şube müdürü · s2
const OGRETMEN = aktor("u4");
const ZAMAN = "2026-11-07T10:00";

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
const yeniAday = (p: Partial<Aday> = {}): Aday => ({
  id: "a-yeni", veliAd: "  Seda   Kaya ", veliTelefon: "+90 (532) 111 22 33", ogrenciAd: "Ecrin Kaya", seviye: 5, okul: "", subeId: "s1", sorumluId: "p9",
  kaynak: "Tavsiye", durum: "yeni", sonrakiAksiyon: "2026-11-07", denemeTarihi: null, olusturma: "1999-01-01", notlar: [],
  vazgecmeNedeni: null, teklif: null, rizaVar: false, ...p,
});
const ekle = (a: Aday) => (x: Db) => void x.adaylar.unshift(a);
const degistir = (id: string, p: Partial<Aday>) => (x: Db) => void (x.adaylar = x.adaylar.map((a) => (a.id === id ? { ...a, ...p } : a)));
const yazilan = (t: Degisiklik) => (t.koleksiyonlar.adaylar?.yaz ?? []) as unknown as Aday[];
const s1Acik = db.adaylar.find((a) => a.subeId === "s1" && a.durum === "gorusuldu")!;
const s2Acik = db.adaylar.find((a) => a.subeId === "s2" && a.durum !== "kayit" && a.durum !== "vazgecti")!;
const kayitli = db.adaylar.find((a) => a.durum === "kayit")!;
const vazgecen = db.adaylar.find((a) => a.durum === "vazgecti" && a.subeId === "s1")!;

describe("yeni aday", () => {
  it("telefon tek biçime, ad boşlukları temizlenir; oluşturma tarihi sunucudan", () => {
    const [a] = yazilan(dene(ekle(yeniAday()))());
    expect(a.veliTelefon).toBe("0532 111 22 33");
    expect(a.veliAd).toBe("Seda Kaya");
    expect(a.olusturma).toBe("2026-11-07");
  });
  it("geçersiz telefon, boş veli adı, geçersiz sınıf reddedilir", () => {
    reddedilir(dene(ekle(yeniAday({ veliTelefon: "12345" }))), /telefon/);
    reddedilir(dene(ekle(yeniAday({ veliAd: " " }))), /Veli adı/);
    reddedilir(dene(ekle(yeniAday({ seviye: 12 }))), /Sınıf/);
  });
  it("doğrudan 'kayıt' durumunda eklenemez", () => {
    reddedilir(dene(ekle(yeniAday({ durum: "kayit", ogrenciId: db.ogrenciler[0].id }))));
  });
  it("aynı veli telefonuyla açık aday varken yinelenen eklenemez (telefon farklı yazılsa da)", () => {
    const tel = s1Acik.veliTelefon.replace(/\s/g, "");
    reddedilir(dene(ekle(yeniAday({ veliTelefon: tel, ogrenciAd: s1Acik.ogrenciAd }))), /açık bir aday zaten var/);
  });
  it("pasif şubeye ve şubede görevli olmayan sorumluyla eklenemez", () => {
    reddedilir(dene(ekle(yeniAday({ subeId: "s3", sorumluId: "p0" })), YONETICI), /Pasif şube/);
    reddedilir(dene(ekle(yeniAday({ sorumluId: "p4" }))), /Sorumlu/); // öğretmen
  });
});

describe("şube kapsamı ve yetki", () => {
  it("başka şubenin adayını değiştiremez / başka şubeye aday ekleyemez", () => {
    reddedilir(dene(degistir(s2Acik.id, { kaynak: "Google" }), GUL), /kapsam/);
    reddedilir(dene(ekle(yeniAday({ subeId: "s2", sorumluId: "p10" })), GUL), /kapsam/);
    expect(dene(degistir(s2Acik.id, { kaynak: "Google" }), MURAT)).not.toThrow();
  });
  it("genel yönetici devredebilir (sorumlu yeni şubede olmalı)", () => {
    reddedilir(dene(degistir(s1Acik.id, { subeId: "s2", sorumluId: "p1" }), YONETICI), /Sorumlu/);
    expect(dene(degistir(s1Acik.id, { subeId: "s2", sorumluId: "p10" }), YONETICI)).not.toThrow();
  });
  it("öğretmen aday yazamaz ve göremez", () => {
    reddedilir(dene(ekle(yeniAday()), OGRETMEN), /yetkiniz yok/);
    expect(okumaSuz(db, OGRETMEN).adaylar).toEqual([]);
  });
  it("okumada yalnızca kapsamdaki şubelerin adayları gider", () => {
    const g = okumaSuz(db, GUL).adaylar;
    expect(g.length).toBeGreaterThan(0);
    expect(g.every((a) => a.subeId === "s1")).toBe(true);
    expect(okumaSuz(db, YONETICI).adaylar.length).toBe(db.adaylar.length);
  });
  it("03 ve 04 yetkisi kapatılan rol aday verisini görmez; yalnızca 04 yetkisiyle kesin kayıt dışında değişiklik yapamaz", () => {
    const v = structuredClone(db);
    v.rolYetkileri.sekreter["03"] = false;
    v.rolYetkileri.sekreter["04"] = false;
    expect(okumaSuz(v, aktor("u9", v)).adaylar).toEqual([]);
    v.rolYetkileri.sekreter["04"] = true;
    reddedilir(dene(degistir(s1Acik.id, { kaynak: "Google" }), aktor("u9", v), v), /yetkiniz yok/);
  });
});

describe("durum akışı ve notlar", () => {
  it("elle 'kayıt' durumu verilemez; kayda dönüşmüş aday geri alınamaz / değiştirilemez", () => {
    reddedilir(dene(degistir(s1Acik.id, { durum: "kayit" })), /Kesin kayda|öğrenci kartına/);
    reddedilir(dene(degistir(kayitli.id, { durum: "gorusuldu", ogrenciId: undefined }), YONETICI), /geri alınamaz/);
    reddedilir(dene(degistir(kayitli.id, { veliAd: "Başka Veli" }), YONETICI), /değiştirilemez/);
  });
  it("vazgeçen aday yeniden açılabilir; vazgeçerken neden zorunlu", () => {
    expect(dene(degistir(vazgecen.id, { durum: "dusunuyor", vazgecmeNedeni: null }))).not.toThrow();
    reddedilir(dene(degistir(s1Acik.id, { durum: "vazgecti", vazgecmeNedeni: null })), /nedeni/);
  });
  it("notlar silinemez; eklenen notun yazarı ve zamanı sunucudan", () => {
    reddedilir(dene(degistir(s1Acik.id, { notlar: [] })), /notları silinemez/);
    const t = dene(degistir(s1Acik.id, { notlar: [...s1Acik.notlar, { tarih: "2000-01-01T00:00", yazar: "Sahte", metin: "Tekrar arandı" }] }))();
    const son = yazilan(t)[0].notlar.at(-1)!;
    expect(son).toEqual({ tarih: ZAMAN, yazar: "Gül Koç", metin: "Tekrar arandı" });
  });
});

describe("kesin kayda dönüşüm (Bölüm 04 sihirbazının paketi)", () => {
  const donustur = (a: Aday, ogrId = "o-yeni") => (x: Db) => {
    x.ogrenciler.push({ ...db.ogrenciler[0], id: ogrId, ad: "Yeni", soyad: "Öğrenci" });
    const g = db.gruplar.find((y) => y.subeId === a.subeId)!;
    x.kayitlar.push({ ...db.kayitlar[0], id: "k-" + ogrId, ogrenciId: ogrId, subeId: a.subeId, grupId: g.id, sozlesmeNo: `${a.subeId === "s1" ? "MRK" : "KZY"}-2026-9001` }); // Bölüm 04: şube koduyla başlamalı
    x.adaylar = x.adaylar.map((y) => (y.id === a.id ? { ...y, durum: "kayit", ogrenciId: ogrId, sonrakiAksiyon: null, vazgecmeNedeni: null } : y));
  };
  it("öğrenci kartı aynı pakette gelince kabul edilir (vazgeçmiş aday dahil)", () => {
    expect(dene(donustur(s1Acik))).not.toThrow();
    expect(dene(donustur(vazgecen))).not.toThrow();
  });
  it("öğrenci kartı olmadan veya başka adaya bağlı öğrenciyle reddedilir", () => {
    reddedilir(dene(degistir(s1Acik.id, { durum: "kayit", ogrenciId: "olmayan" })), /öğrenci kartı/);
    const v = structuredClone(db);
    const bagli = db.ogrenciler.find((o) => db.kayitlar.some((k) => k.ogrenciId === o.id && k.subeId === "s1"))!.id;
    v.adaylar = v.adaylar.map((a) => (a.id === kayitli.id ? { ...a, ogrenciId: bagli } : a));
    reddedilir(dene(degistir(s1Acik.id, { durum: "kayit", ogrenciId: bagli }), YONETICI, v), /başka bir adaya/);
  });
});

describe("modül kapalı ve KVKK", () => {
  const kapali = structuredClone(db);
  kapali.moduller.onKayit = false;
  it("ön kayıt modülü kapalıyken aday yazılamaz", () => {
    reddedilir(dene(ekle(yeniAday()), YONETICI, kapali), /modülü kapalı/);
    reddedilir(dene(degistir(s1Acik.id, { kaynak: "Google" }), YONETICI, kapali), /modülü kapalı/);
  });
  it("vazgeçen adayın anonimleştirilmesi modül kapalıyken de yapılabilir, açık aday anonimleştirilemez", () => {
    const anonim = { veliAd: "A*** ***", veliTelefon: "*** *** ** **", ogrenciAd: "E***", notlar: [] };
    expect(dene(degistir(vazgecen.id, anonim), YONETICI, kapali)).not.toThrow();
    reddedilir(dene(degistir(s1Acik.id, anonim), YONETICI), /vazgeçen/);
    reddedilir(dene(degistir(vazgecen.id, anonim), GUL), /KVKK/); // sekreterde 14 yok
  });
  it("aday silinemez", () => {
    reddedilir(dene((x) => void (x.adaylar = x.adaylar.filter((a) => a.id !== s1Acik.id)), YONETICI), /silinemez/);
  });
});

describe("kapsam dışındaki şubeye devir (karar 2026-11-07)", () => {
  const devret = (id: string, subeId: string, p: Partial<Aday> = {}) => (x: Db) =>
    void (x.adaylar = x.adaylar.map((a) =>
      a.id === id ? { ...a, subeId, notlar: [...a.notlar, { tarih: ZAMAN, yazar: "Gül Koç", metin: "Devredildi" }], ...p } : a));
  it("kapsamı sınırlı kullanıcı kendi adayını kapsam dışındaki aktif şubeye devreder; sorumlu hedef şubeden atanır", () => {
    const t = dene(devret(s1Acik.id, "s2", { sorumluId: "p9" }), GUL)();
    const [a] = yazilan(t);
    expect(a.subeId).toBe("s2");
    expect(a.sorumluId).toBe("p10"); // istemcinin gönderdiği p9 yerine s2'nin sekreteri
    // Devirden sonra aday devredenin kapsamından çıkar
    const sonraki = farkUygula(db, t);
    expect(okumaSuz(sonraki, GUL).adaylar.some((x) => x.id === s1Acik.id)).toBe(false);
    expect(okumaSuz(sonraki, MURAT).adaylar.some((x) => x.id === s1Acik.id)).toBe(true);
  });
  it("devirle aynı pakette başka alan değiştirilemez, not silinemez", () => {
    reddedilir(dene(devret(s1Acik.id, "s2", { kaynak: `${s1Acik.kaynak} değişti` }), GUL), /diğer bilgileri/);
    reddedilir(dene(devret(s1Acik.id, "s2", { notlar: [] }), GUL), /notları/);
  });
  it("pasif şubeye, kayda dönmüş veya başka şubenin adayı devredilemez", () => {
    reddedilir(dene(devret(s1Acik.id, "s3"), GUL), /Pasif/);
    reddedilir(dene(devret(kayitli.id, kayitli.subeId === "s1" ? "s2" : "s1"), YONETICI), /devredilemez/);
    const v = structuredClone(db);
    v.adaylar = v.adaylar.map((a) => (a.id === s1Acik.id ? { ...a, durum: "kayit", ogrenciId: db.ogrenciler[0].id } : a));
    reddedilir(dene(devret(s1Acik.id, "s2"), GUL, v), /devredilemez/);
    reddedilir(dene(devret(s2Acik.id, "s1"), GUL), /kapsam/); // eski şubede yetkisi yok
  });
  it("hedef şubede takip edecek personel yoksa devredilemez", () => {
    const v = structuredClone(db);
    v.personel = v.personel.map((p) => (p.subeIds.includes("s2") && p.gorev !== "ogretmen" ? { ...p, subeIds: p.subeIds.filter((x) => x !== "s2") } : p));
    reddedilir(dene(devret(s1Acik.id, "s2"), aktor("u9", v), v), /personel yok/);
  });
  it("istisna yalnızca aday devri içindir: başka koleksiyonda kapsam dışına yazma reddedilir", () => {
    reddedilir(dene((x) => void x.islemler.unshift({ id: "is-t", zaman: ZAMAN, kullanici: "", islem: "x", detay: "", subeId: "s2" }), GUL), /kapsam/);
    reddedilir(dene(ekle(yeniAday({ subeId: "s2", sorumluId: "p10" })), GUL), /kapsam/); // yeni aday devir değildir
  });
});
