/**
 * Bölüm 10 sunucu denetimi: yazmaDenetle → iletisimDenetle, kuyruk (sahte SMS sağlayıcısı), veliVerisi, otomasyon, veli API'si.
 * Politika testlerinde zaman parametredir; gerçek saate bağlı sabit tarih yok. Gerçek SMS gönderilmez.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ornekVeriUret, type Aday, type Db, type Duyuru, type Gonderim, tanimKaynagi } from "@/data/model";
import { farkHesapla, farkUygula } from "@/data/fark";
import { YetkiHatasi, okumaSuz, veliVerisi, yazmaDenetle, type Aktor } from "../../../server/politika";
import { KonsolSms, kuyruguIsle, type KuyrukBaglami, type PushGonderici, type SmsSonucu } from "../../../server/gonderim";
import { otomasyonlariCalistir } from "../../../server/zamanlayici";
import { uygulamaOlustur } from "../../../server/uygulama";
import { baglan } from "../../../server/veritabani";
import { TAKILI_HATA } from "./kurallar";

const BUGUN = "2026-11-09";
const ZAMAN = `${BUGUN}T15:00`;
const ham = ornekVeriUret();
tanimKaynagi(ham);
const db: Db = { ...ham, gonderimler: [], duyurular: [], moduller: { ...ham.moduller, finans: true, onKayit: true } };
const kisi = (id: string): Aktor => {
  const kullanici = db.kullanicilar.find((k) => k.id === id)!;
  return { kullanici, personel: db.personel.find((p) => p.id === kullanici.personelId)! };
};
const YONETICI = kisi("u0");
const MUDUR = kisi("u1");
const OGRETMEN = kisi(db.kullanicilar.find((k) => k.rol === "ogretmen")!.id);
const aktifler = (s: string) => db.kayitlar.filter((k) => k.subeId === s && k.durum === "aktif").map((k) => db.ogrenciler.find((o) => o.id === k.ogrenciId)!).filter((o) => o.durum === "aktif");
const S1 = aktifler("s1")[0];
const S2 = aktifler("s2")[0];
const VELI = S1.birincilVeliId;
/** Şablona uyan devamsızlık dışı metin */
const HOS = "Ali kaydı tamamlandı, hoş geldiniz! Veli portalı: classmate.app/veli — Merkez";

const satir = (id: string, p: Partial<Gonderim> = {}): Gonderim => ({ id, zaman: "x", olay: "hosgeldin", veliId: VELI, alici: "sahte · 05559998877", ogrenciId: S1.id, subeId: "s1", kanal: "sms", metin: HOS, durum: "iletildi", maliyet: 0, ...p });
const duyuru = (p: Partial<Duyuru> = {}): Duyuru => ({ id: "duX", baslik: "Tatil", metin: "Ders yok {sube_adi}", hedef: { tur: "sube", deger: "s1" }, kanal: "push+sms", zaman: "x", zamanlanmis: false, gonderen: "sahte", aliciVeliIds: ["sahte"], okuyanVeliIds: ["sahte"], ...p });

function dene(fn: (x: Db) => void, a: Aktor = MUDUR, kaynak: Db = db) {
  const taslak = { ...kaynak } as Db;
  for (const k of Object.keys(taslak) as (keyof Db)[]) {
    const v = taslak[k];
    if (Array.isArray(v)) (taslak as Record<string, unknown>)[k] = [...v];
  }
  fn(taslak);
  const fark = farkHesapla(kaynak, taslak);
  return () => yazmaDenetle(kaynak, farkUygula(kaynak, fark), fark, a, ZAMAN);
}
const reddedilir = (f: () => unknown, m?: RegExp) => {
  expect(f).toThrow(YetkiHatasi);
  if (m) expect(f).toThrow(m);
};
const gonderimler = (t: ReturnType<ReturnType<typeof dene>>) => (t.koleksiyonlar.gonderimler?.yaz ?? []) as unknown as Gonderim[];
const izinli = (p: Partial<Db["veliler"][number]>): Db => ({ ...db, veliler: db.veliler.map((v) => (v.id === VELI ? { ...v, ...p } : v)) });

describe("personelin gönderim satırı", () => {
  it("alıcı, şube, kanal, maliyet, durum istemciden alınmaz", () => {
    const [g] = gonderimler(dene((x) => x.gonderimler.push(satir("g1", { maliyet: 99, subeId: "s1", hata: "x", deneme: 9, gonderimBasladi: "y" })), MUDUR, izinli({ pushAcik: false, izinSms: true }))());
    const v = db.veliler.find((x) => x.id === VELI)!;
    expect(g.alici).toContain(v.telefon);
    expect(g.durum).toBe("bekliyor");
    expect(g.kanal).toBe("sms");
    expect(g.maliyet).toBeCloseTo(db.ayarlar.smsBirimFiyat * 2);
    expect(g).not.toHaveProperty("hata");
    expect(g).not.toHaveProperty("deneme");
    expect(g).not.toHaveProperty("gonderimBasladi");
  });
  it("velisiz satırla başka numaraya yazılamaz", () => {
    reddedilir(dene((x) => x.gonderimler.push(satir("g1", { veliId: null }))), /Alıcısız/);
  });
  it("başka öğrencinin velisine yazılamaz", () => {
    reddedilir(dene((x) => x.gonderimler.push(satir("g1", { veliId: S2.birincilVeliId }))), /velisine/);
  });
  it("kapsam dışı öğrenciye yazılamaz (satırın şubesi sahte olsa da)", () => {
    reddedilir(dene((x) => x.gonderimler.push(satir("g1", { veliId: S2.birincilVeliId, ogrenciId: S2.id, subeId: "s1" }))), /kapsam/);
  });
  it("bilinmeyen olay reddedilir", () => {
    reddedilir(dene((x) => x.gonderimler.push(satir("g1", { olay: "uydurma" as never }))), /Bilinmeyen/);
  });
  it("sunucu olayları istemciden düşer (giriş kodu, düzeltme)", () => {
    for (const olay of ["otp", "devamsizlikDuzeltme", "odevDuzeltme"] as const) expect(gonderimler(dene((x) => x.gonderimler.push(satir("g1", { olay })))())).toEqual([]);
  });
  it("öğretmen finans bildirimi yazamaz", () => {
    reddedilir(dene((x) => x.gonderimler.push(satir("g1", { olay: "gecikmisOdeme" })), OGRETMEN), /yetkiniz/);
  });
  it("serbest metin SMS olmaz, uygulama bildirimine döner", () => {
    const [g] = gonderimler(dene((x) => x.gonderimler.push(satir("g1", { metin: "Şu hesaba para yatırın" })), MUDUR, izinli({ pushAcik: false }))());
    expect(g).toMatchObject({ kanal: "push", maliyet: 0 });
  });
  it("SMS izni kapalı veliye (kalan olaylarda) SMS gitmez", () => {
    const [g] = gonderimler(dene((x) => x.gonderimler.push(satir("g1")), MUDUR, izinli({ izinSms: false }))());
    expect(g).toMatchObject({ kanal: "push", maliyet: 0 });
  });
  it("aşırı uzun metin reddedilir", () => {
    reddedilir(dene((x) => x.gonderimler.push(satir("g1", { metin: "a".repeat(1001) }))), /uzun/);
  });
  it("kapalı olay ve kapalı modül satırı düşer", () => {
    const k: Db = { ...db, olaylar: db.olaylar.map((o) => (o.key === "hosgeldin" ? { ...o, aktif: false } : o)) };
    expect(gonderimler(dene((x) => x.gonderimler.push(satir("g1")), MUDUR, k)())).toEqual([]);
    const f: Db = { ...db, moduller: { ...db.moduller, finans: false } };
    expect(gonderimler(dene((x) => x.gonderimler.push(satir("g1", { olay: "odemeAlindi" })), MUDUR, f)())).toEqual([]);
  });
});

describe("yeniden kuyruğa alma", () => {
  const basarisiz = (p: Partial<Gonderim> = {}): Db => ({ ...db, gonderimler: [satir("g0", { durum: "basarisiz", hata: "h", ...p })] });
  const tekrar = (k: Db, a: Aktor = MUDUR) => dene((x) => (x.gonderimler = x.gonderimler.map((g) => ({ ...g, durum: "bekliyor" as const }))), a, k);
  it("başarısız satır kuyruğa döner, deneme artar, istemci alanları yok sayılır", () => {
    const k = basarisiz();
    const [g] = gonderimler(dene((x) => (x.gonderimler = x.gonderimler.map((y) => ({ ...y, durum: "iletildi" as const, metin: "değişti", maliyet: 0 }))), MUDUR, k)());
    expect(g).toMatchObject({ durum: "bekliyor", deneme: 1, metin: HOS, zaman: ZAMAN });
    expect(g.hata).toBeUndefined();
  });
  it("sınır aşılınca reddedilir", () => reddedilir(tekrar(basarisiz({ deneme: 3 })), /en fazla/));
  it("giriş kodu yeniden gönderilemez", () => reddedilir(tekrar(basarisiz({ olay: "otp" })), /yeni kod/));
  it("iletilmiş satır değiştirilemez", () => reddedilir(tekrar({ ...db, gonderimler: [satir("g0", { durum: "iletildi" })] }), /değiştirilemez/));
});

describe("aday hedefli gönderim (Bölüm 03 devri)", () => {
  const aday = (riza: boolean): Aday => ({ ...db.adaylar[0], id: "aX", veliAd: "Sema", veliTelefon: "0532 111 22 33", subeId: "s1", sorumluId: db.personel.find((p) => p.subeIds.includes("s1"))!.id, rizaVar: riza, durum: "yeni", notlar: [], teklif: null, vazgecmeNedeni: null, denemeTarihi: null } as Aday);
  const s = db.subeler.find((x) => x.id === "s1")!;
  const metin = `Bilgi talebiniz için teşekkürler, sizi en kısa sürede arayacağız. ${s.ad} ${s.telefon}`;
  const g = (p: Partial<Gonderim> = {}) => satir("g1", { olay: "onKayitTesekkur", veliId: null, ogrenciId: null, alici: "Sema · 05321112233", metin, ...p });
  it("rızalı adaya, adaydan alınan numarayla gider", () => {
    const [r] = gonderimler(dene((x) => { x.adaylar.unshift(aday(true)); x.gonderimler.push(g()); })());
    expect(r).toMatchObject({ adayId: "aX", kanal: "sms", subeId: "s1", alici: "Sema · 0532 111 22 33" });
  });
  it("rıza yoksa satır düşer", () => {
    expect(gonderimler(dene((x) => { x.adaylar.unshift(aday(false)); x.gonderimler.push(g()); })())).toEqual([]);
  });
  it("paketteki adaydan farklı numaraya yazılamaz", () => {
    reddedilir(dene((x) => { x.adaylar.unshift(aday(true)); x.gonderimler.push(g({ alici: "X · 05559998877" })); }), /adaya/);
  });
  it("aday olmadan yazılamaz", () => reddedilir(dene((x) => x.gonderimler.push(g())), /adaya/));
});

describe("duyuru", () => {
  const yeni = (du: Duyuru, a: Aktor = MUDUR, k: Db = db) => dene((x) => x.duyurular.push(du), a, k)();
  const yazilan = (t: ReturnType<typeof yeni>) => t.koleksiyonlar.duyurular!.yaz[0] as unknown as Duyuru;
  it("alıcı, gönderen, okundu sunucudan; kişi başı tek satır", () => {
    const t = yeni(duyuru());
    const du = yazilan(t);
    expect(du.okuyanVeliIds).toEqual([]);
    expect(du.aliciVeliIds).not.toContain("sahte");
    expect(du.gonderen).toBe(`${MUDUR.personel.ad} ${MUDUR.personel.soyad}`);
    expect(du.aliciVeliIds.length).toBeGreaterThan(0);
    const l = gonderimler(t);
    expect(l).toHaveLength(du.aliciVeliIds.length);
    expect(new Set(l.map((g) => g.veliId)).size).toBe(l.length);
  });
  it("istemcinin duyuru satırları yok sayılır", () => {
    const t = dene((x) => { x.duyurular.push(duyuru()); x.gonderimler.push(satir("sahte", { olay: "duyuru", metin: "Sahte" })); })();
    expect(gonderimler(t).some((g) => g.id === "sahte" || g.metin === "Sahte")).toBe(false);
  });
  it("şube değişkeni velinin hedefteki çocuğunun şubesinden", () => {
    const merkez = db.subeler.find((s) => s.id === "s1")!;
    for (const g of gonderimler(yeni(duyuru()))) {
      expect(g.subeId).toBe("s1");
      expect(g.metin).toContain(merkez.ad);
    }
  });
  it("SMS izni kapalı veliye duyuru SMS'i gitmez", () => {
    const k: Db = { ...db, veliler: db.veliler.map((v) => ({ ...v, pushAcik: false, izinSms: false })) };
    expect(gonderimler(yeni(duyuru(), MUDUR, k)).every((g) => g.kanal === "push" && g.maliyet === 0)).toBe(true);
  });
  it("şube personeli başka şubeye ve tüm velilere gönderemez", () => {
    reddedilir(() => yeni(duyuru({ hedef: { tur: "sube", deger: "s2" } })), /kapsam/);
    reddedilir(() => yeni(duyuru({ hedef: { tur: "tum", deger: null } })), /kapsam/);
  });
  it("şube personelinin seviye duyurusu yalnız kendi şubesine gider", () => {
    const sev = String(db.gruplar.find((g) => g.subeId === "s1")!.seviye);
    const kap = MUDUR.kullanici.subeIds as string[];
    const t = yeni(duyuru({ hedef: { tur: "seviye", deger: sev }, subeIds: kap }));
    expect(gonderimler(t).every((g) => kap.includes(g.subeId))).toBe(true);
    reddedilir(() => yeni(duyuru({ hedef: { tur: "seviye", deger: sev }, subeIds: null })), /kapsam/);
    reddedilir(() => yeni(duyuru({ hedef: { tur: "seviye", deger: sev }, subeIds: ["s2"] })), /kapsam/);
  });
  it("hedef geçersizse reddedilir", () => reddedilir(() => yeni(duyuru({ hedef: { tur: "grup", deger: "yok" } }), YONETICI), /hedef/));
  it("zamanlanmış duyuru satır üretmez; gönderilince bir kez üretir, ikinci kez değiştirilemez", () => {
    const t = yeni(duyuru({ zamanlanmis: true, zaman: `${BUGUN}T19:00` }));
    expect(gonderimler(t)).toEqual([]);
    const k: Db = { ...db, duyurular: [yazilan(t)] };
    const g = dene((x) => (x.duyurular = x.duyurular.map((d) => ({ ...d, zamanlanmis: false }))), MUDUR, k)();
    expect(gonderimler(g).length).toBeGreaterThan(0);
    expect(yazilan(g).zaman).toBe(ZAMAN);
    const giden: Db = { ...db, duyurular: [yazilan(g)] };
    reddedilir(dene((x) => (x.duyurular = x.duyurular.map((d) => ({ ...d, metin: "yeni" }))), MUDUR, giden), /değiştirilemez/);
  });
  it("kapalı olayda duyuru satır üretmez", () => {
    const k: Db = { ...db, olaylar: db.olaylar.map((o) => (o.key === "duyuru" ? { ...o, aktif: false } : o)) };
    expect(gonderimler(yeni(duyuru(), MUDUR, k))).toEqual([]);
  });
});

describe("olay ayarları ve iletişim ayarları", () => {
  const sablon = (s: string, a: Aktor = YONETICI) => dene((x) => (x.olaylar = x.olaylar.map((o) => (o.key === "devamsizlik" ? { ...o, sablon: s } : o))), a);
  it("yalnızca genel yönetici değiştirir", () => reddedilir(sablon("{ogrenci}", MUDUR), /genel yönetici/));
  it("geçerli şablon kaydedilir, tanınmayan değişken reddedilir", () => {
    expect(sablon("{ogrenci} gelmedi")).not.toThrow();
    reddedilir(sablon("{tutar}"), /kullanılamayan/);
  });
  it("olay adı değiştirilemez", () => reddedilir(dene((x) => (x.olaylar = x.olaylar.map((o) => (o.key === "duyuru" ? { ...o, ad: "X" } : o))), YONETICI), /tanımı/));
  it("bozuk gönderim aralığı ve negatif fiyat reddedilir", () => {
    reddedilir(dene((x) => (x.ayarlar = { ...x.ayarlar, gonderimBas: "22:00", gonderimBit: "06:00" }), YONETICI), /önce/);
    reddedilir(dene((x) => (x.ayarlar = { ...x.ayarlar, smsBirimFiyat: -1 }), YONETICI), /fiyat/);
  });
});

describe("veli ve okuma görünümü", () => {
  it("veliye hata, maliyet, alıcı, giriş kodu gitmez", () => {
    const k: Db = { ...db, gonderimler: [satir("a", { hata: "Netgsm 30", maliyet: 5 }), satir("b", { olay: "otp" }), satir("c", { veliId: S2.birincilVeliId, ogrenciId: S2.id })] };
    const l = veliVerisi(k, VELI).gonderimler;
    expect(l.map((g) => g.id)).toEqual(["a"]);
    expect(l[0]).toMatchObject({ alici: "", maliyet: 0 });
    expect(l[0].hata).toBeUndefined();
  });
  it("öğretmen gönderim kaydı görmez, şube personeli yalnız kendi şubesini", () => {
    const k: Db = { ...db, gonderimler: [satir("a"), satir("b", { subeId: "s2" })] };
    expect(okumaSuz(k, OGRETMEN, BUGUN).gonderimler).toEqual([]);
    expect(okumaSuz(k, MUDUR, BUGUN).gonderimler.map((g) => g.id)).toEqual(["a"]);
  });
});

describe("otomasyon", () => {
  it("zamanlanmış seviye duyurusu şube sınırını korur", () => {
    const sev = String(db.gruplar.find((g) => g.subeId === "s1")!.seviye);
    const k: Db = { ...db, duyurular: [duyuru({ id: "z", hedef: { tur: "seviye", deger: sev }, subeIds: ["s1"], zamanlanmis: true, zaman: "2000-01-01T10:00", aliciVeliIds: [], okuyanVeliIds: [] })], otomasyon: {} };
    const x = otomasyonlariCalistir(k);
    const giden = x.gonderimler.filter((g) => g.olay === "duyuru");
    expect(giden.length).toBeGreaterThan(0);
    expect(giden.every((g) => g.subeId === "s1")).toBe(true);
    expect(x.duyurular[0].zamanlanmis).toBe(false);
    expect(otomasyonlariCalistir(x).gonderimler.length).toBe(x.gonderimler.length);
  });
});

describe("kuyruk", () => {
  class SahteSms {
    ad = "sahte";
    giden: { telefon: string; metin: string }[] = [];
    sonuc: SmsSonucu = { tamam: true, ref: "1" };
    atsin = false;
    onceki?: () => void;
    async gonder(telefon: string, metin: string): Promise<SmsSonucu> {
      this.onceki?.();
      if (this.atsin) throw new Error("kopuk");
      this.giden.push({ telefon, metin });
      return this.sonuc;
    }
  }
  const kur = (rows: Gonderim[], ekle: Partial<Db> = {}, p: Partial<KuyrukBaglami> = {}) => {
    const durum = { db: { ...db, gonderimler: rows, ayarlar: { ...db.ayarlar, gonderimBas: "08:00", gonderimBit: "21:00" }, ...ekle } as Db };
    const sms = new SahteSms();
    const silinen: string[] = [];
    const b: KuyrukBaglami = {
      db: () => durum.db, sms, push: null, saat: () => "12:00",
      abonelikler: async () => [], abonelikSil: async (e) => void silinen.push(e),
      yamala: async (id, y) => void (durum.db = { ...durum.db, gonderimler: durum.db.gonderimler.map((g) => (g.id === id ? { ...g, ...y } : g)) }),
      ...p,
    };
    return { durum, sms, b, silinen, satir: (id: string) => durum.db.gonderimler.find((g) => g.id === id)! };
  };
  const bek = (id: string, p: Partial<Gonderim> = {}) => satir(id, { durum: "bekliyor", ...p });

  it("SMS iletilince maliyet yazılır, işaret temizlenir, ikinci çalışma göndermez", async () => {
    const t = kur([bek("a")]);
    await kuyruguIsle(t.b);
    expect(t.satir("a")).toMatchObject({ durum: "iletildi", kanal: "sms" });
    expect(t.satir("a").gonderimBasladi).toBeUndefined();
    expect(t.satir("a").maliyet).toBeGreaterThan(0);
    await kuyruguIsle(t.b);
    expect(t.sms.giden).toHaveLength(1);
  });
  it("gönderimden önce işaret kalıcı yazılır", async () => {
    const t = kur([bek("a")]);
    let isaret: string | undefined;
    t.sms.onceki = () => (isaret = t.satir("a").gonderimBasladi);
    await kuyruguIsle(t.b);
    expect(isaret).toBeTruthy();
  });
  it("işaret yazılamazsa SMS gönderilmez", async () => {
    const t = kur([bek("a")], {}, { yamala: async () => { throw new Error("db"); } });
    await expect(kuyruguIsle(t.b)).rejects.toThrow();
    expect(t.sms.giden).toEqual([]);
  });
  it("takılı satır yeniden gönderilmez", async () => {
    const t = kur([bek("a", { gonderimBasladi: "t" })]);
    await kuyruguIsle(t.b);
    expect(t.sms.giden).toEqual([]);
  });
  it("sonuç yazılamazsa satır takılı kalır, tekrar gönderilmez", async () => {
    let n = 0;
    const d = { ...db, gonderimler: [bek("a")] } as Db;
    const t = kur(d.gonderimler);
    const asil = t.b.yamala;
    t.b.yamala = async (id, y) => { if (++n === 2) throw new Error("db"); await asil(id, y); };
    await expect(kuyruguIsle(t.b)).rejects.toThrow();
    t.b.yamala = asil;
    await kuyruguIsle(t.b);
    expect(t.sms.giden).toHaveLength(1);
  });
  it("sağlayıcı hatası başarısız, maliyetsiz; sağlayıcı istisnası kuyruğu durdurmaz", async () => {
    const t = kur([bek("a"), bek("b")]);
    t.sms.sonuc = { tamam: false, hata: "Netgsm 30" };
    t.sms.atsin = true;
    await kuyruguIsle(t.b);
    expect(t.satir("a")).toMatchObject({ durum: "basarisiz", maliyet: 0 });
    expect(t.satir("b").durum).toBe("basarisiz");
  });
  it("gönderim saati dışında bekler; giriş kodu beklemez", async () => {
    const t = kur([bek("a"), bek("o", { olay: "otp" })], {}, { saat: () => "23:00" });
    await kuyruguIsle(t.b);
    expect(t.satir("a").durum).toBe("bekliyor");
    expect(t.satir("a").gonderimBasladi).toBeUndefined();
    expect(t.satir("o").durum).toBe("iletildi");
  });
  const kapali = () => db.veliler.map((v) => (v.id === VELI ? { ...v, izinSms: false } : v));
  it("kuyruktayken SMS izni kapatılırsa SMS gitmez, maliyet sıfırlanır", async () => {
    const t = kur([bek("a", { maliyet: 3 })], { veliler: kapali() });
    await kuyruguIsle(t.b);
    expect(t.sms.giden).toEqual([]);
    expect(t.satir("a")).toMatchObject({ durum: "iletildi", kanal: "push", maliyet: 0 });
  });
  it("giriş kodu SMS izninden etkilenmez", async () => {
    const t = kur([bek("a", { olay: "otp" })], { veliler: kapali() });
    await kuyruguIsle(t.b);
    expect(t.sms.giden).toHaveLength(1);
  });
  it("adayın rızası kaldırıldıysa SMS gitmez", async () => {
    const t = kur([bek("a", { veliId: null, ogrenciId: null, olay: "onKayitTesekkur", adayId: "aX", alici: "S · 05321112233" })], { adaylar: [{ ...db.adaylar[0], id: "aX", rizaVar: false }] });
    await kuyruguIsle(t.b);
    expect(t.sms.giden).toEqual([]);
    expect(t.satir("a").durum).toBe("basarisiz");
  });
  it("gönderim sürerken silinen satır işlenmez", async () => {
    const t = kur([bek("a"), bek("b")]);
    t.sms.onceki = () => void (t.durum.db = { ...t.durum.db, gonderimler: t.durum.db.gonderimler.filter((g) => g.id !== "b") });
    await kuyruguIsle(t.b);
    expect(t.sms.giden).toHaveLength(1);
  });
  const abonelik = { endpoint: "e1", abonelik: { endpoint: "e1", keys: { p256dh: "k", auth: "a" } } };
  it("push iletilirse SMS'e düşmez", async () => {
    const push: PushGonderici = { acikAnahtar: "x", gonder: async () => ({ tamam: true }) };
    const t = kur([bek("a", { kanal: "push", olay: "devamsizlik" })], {}, { push, abonelikler: async () => [abonelik] });
    await kuyruguIsle(t.b);
    expect(t.sms.giden).toEqual([]);
    expect(t.satir("a")).toMatchObject({ durum: "iletildi", kanal: "push" });
  });
  it("410 aboneliği silinir, uygulama + SMS olayı SMS'e düşer", async () => {
    const push: PushGonderici = { acikAnahtar: "x", gonder: async () => ({ tamam: false, gecersiz: true }) };
    const t = kur([bek("a", { kanal: "push", olay: "devamsizlik" })], {}, { push, abonelikler: async () => [abonelik] });
    await kuyruguIsle(t.b);
    expect(t.silinen).toEqual(["e1"]);
    expect(t.satir("a")).toMatchObject({ durum: "iletildi", kanal: "sms" });
  });
  it("SMS izni kapalıysa yedek SMS de gitmez", async () => {
    const t = kur([bek("a", { kanal: "push", olay: "devamsizlik" })], { veliler: kapali() });
    await kuyruguIsle(t.b);
    expect(t.sms.giden).toEqual([]);
    expect(t.satir("a").kanal).toBe("push");
  });
});

describe("API", () => {
  const sms = new KonsolSms();
  let app: Awaited<ReturnType<typeof uygulamaOlustur>>;
  let cerez = "";
  let v: Db["veliler"][number];
  const iste = async (yol: string, govde?: unknown) => {
    const r = await app.app.request(yol, { method: govde === undefined ? "GET" : "POST", headers: { cookie: cerez, "content-type": "application/json" }, body: govde === undefined ? undefined : JSON.stringify(govde) });
    const c = r.headers.get("set-cookie");
    if (c) cerez = c.split(";")[0];
    return { durum: r.status, veri: await r.json() };
  };
  let baglanti: Awaited<ReturnType<typeof baglan>>;
  const sayi = async (veliId: string) => (await baglanti.q("select count(*)::int as n from push_abonelik where veli_id = $1", [veliId]))[0].n as number;
  beforeAll(async () => {
    baglanti = await baglan();
    app = await uygulamaOlustur({ vt: baglanti, sms, push: null, demo: true, uretim: false });
    v = app.durum.db.veliler.find((x) => app.durum.db.ogrenciler.some((o) => o.veliIds.includes(x.id) && o.durum === "aktif"))!;
    const k = await iste("/api/veli/kod", { telefon: v.telefon });
    await iste("/api/veli/giris", { telefon: v.telefon, kod: k.veri.demoKod });
  }, 120_000);
  afterAll(async () => {
    await (baglanti as unknown as { kapat?: () => Promise<void> }).kapat?.();
  });
  const abone = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "k", auth: "a" } };

  it("abonelik yalnızca bilinen servise, yalnızca kendi velisine", async () => {
    expect((await iste("/api/veli/push/abone", { abonelik: { ...abone, endpoint: "https://169.254.169.254/x" } })).durum).toBe(400);
    expect((await iste("/api/veli/push/abone", { abonelik: abone, veliId: "baskasi" })).durum).toBe(200);
    expect(await sayi(v.id)).toBe(1);
  });
  it("bildirimi kapatan velinin aboneliği silinir", async () => {
    expect((await iste("/api/veli/tercih", { pushAcik: false })).durum).toBe(200);
    expect(await sayi(v.id)).toBe(0);
  });
  it("talep hız sınırı ve uzunluk", async () => {
    await iste("/api/veli/talep", { metin: "a".repeat(900) });
    expect(app.durum.db.islemler.find((i) => i.islem === "Bilgi güncelleme talebi")!.detay).toHaveLength(500);
    for (let i = 0; i < 4; i++) expect((await iste("/api/veli/talep", { metin: "b" })).durum).toBe(200);
    expect((await iste("/api/veli/talep", { metin: "b" })).durum).toBe(429);
  });
  it("okundu yalnızca alıcısı olduğu duyuruda", async () => {
    const ozel = app.durum.db.duyurular.find((d) => !d.aliciVeliIds.includes(v.id));
    if (ozel) {
      await iste("/api/veli/okundu", { duyuruIds: [ozel.id] });
      expect(app.durum.db.duyurular.find((d) => d.id === ozel.id)!.okuyanVeliIds).not.toContain(v.id);
    }
    expect((await iste("/api/veli/okundu", { duyuruIds: "bozuk" })).durum).toBe(200);
  });
  it("takılı satır çalıştırmada başarısız işaretlenir, gönderilmez", async () => {
    const s = { ...satir("takili", { durum: "bekliyor", gonderimBasladi: "t" }), veliId: v.id };
    await app.kaydet({ koleksiyonlar: { gonderimler: { yaz: [s as never], sil: [] } }, tekil: {} });
    const once = sms.gonderilenler.length;
    await app.kuyrukCalistir();
    expect(app.durum.db.gonderimler.find((g) => g.id === "takili")).toMatchObject({ durum: "basarisiz", hata: TAKILI_HATA });
    expect(sms.gonderilenler.slice(once).some((g) => g.metin === HOS)).toBe(false);
  });
});
