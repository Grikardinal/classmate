/**
 * Bölüm 09 sunucu denetimi: yazmaDenetle → etutDenetle, okumaSuz, veliVerisi, otomasyon ve veli API'si.
 * Politika testlerinde saat sabittir; API testi gömülü veritabanında gerçek saatten ileriye doğru tarih hesaplar.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as model from "@/data/model";
import { aktifKayit, ornekVeriUret, type Db, type Gonderim, type Musaitlik, type Paket, type Randevu } from "@/data/model";
import { farkHesapla, farkUygula } from "@/data/fark";
import { tarihEkle, haftaGunu } from "@/lib/kurallar";
import { YetkiHatasi, okumaSuz, veliVerisi, yazmaDenetle, type Aktor } from "../../../server/politika";
import { otomasyonlariCalistir } from "../../../server/zamanlayici";
import { KonsolSms } from "../../../server/gonderim";
import { uygulamaOlustur } from "../../../server/uygulama";
import { baglan } from "../../../server/veritabani";

const BUGUN = "2026-11-09";
const ZAMAN = `${BUGUN}T15:00`;
const SALI = "2026-11-10";
const GECEN_SALI = "2026-11-03";
const ham = ornekVeriUret();
const mu: Musaitlik = { id: "mu1", ogretmenId: "p4", subeId: "s1", gun: 2, bas: "14:00", bit: "16:00" };
const db: Db = {
  ...ham,
  program: ham.program.map((p) => ({ ...p, baslangic: "2026-09-01" })).filter((p) => p.ogretmenId !== "p4" || p.gun !== 2),
  tatiller: [], iptaller: [], randevular: [], paketler: [], gonderimler: [], musaitlikler: [mu],
  moduller: { ...ham.moduller, etut: true, finans: true },
};
const kisi = (id: string): Aktor => {
  const kullanici = db.kullanicilar.find((k) => k.id === id)!;
  return { kullanici, personel: db.personel.find((p) => p.id === kullanici.personelId)! };
};
const YONETICI = kisi("u0");
const MUDUR = kisi("u1");
const ogretmenOl = (id: string) => kisi(db.kullanicilar.find((x) => x.rol === "ogretmen" && x.personelId === id)!.id);
const OGRETMEN = ogretmenOl("p4");
const p4Gruplari = new Set(db.program.concat(ham.program).filter((p) => p.ogretmenId === "p4").map((p) => p.grupId));
const g1 = db.kayitlar.filter((k) => k.grupId === "g1" && k.durum === "aktif").map((k) => k.ogrenciId);
const [OGR, OGR2] = g1;
const BASKA = db.kayitlar.find((k) => k.subeId === "s1" && k.durum === "aktif" && !p4Gruplari.has(k.grupId) && db.gruplar.find((g) => g.id === k.grupId)?.rehberId !== "p4")!.ogrenciId;
const S2_OGR = db.kayitlar.find((k) => k.subeId === "s2" && k.durum === "aktif")!.ogrenciId;
const VELI = db.ogrenciler.find((o) => o.id === OGR)!.birincilVeliId;
const KAPALI: Db = { ...db, moduller: { ...db.moduller, etut: false } };

const randevu = (p: Partial<Randevu> = {}): Randevu => ({ id: "rX", ogretmenId: "p4", subeId: "s1", tarih: SALI, bas: "14:00", bit: "14:40", tur: "bireysel", ogrenciIds: [OGR], dersId: "l2", durum: "planli", link: "", paketId: null, olusturan: "yonetim", ...p });
const paket = (p: Partial<Paket> = {}): Paket => ({ id: "pkX", ogrenciId: OGR, ogretmenId: "p4", dersId: "l2", toplam: 4, kalan: 2, fiyat: 900, tarih: "2026-10-01", ...p });
const gonderim = (id: string, p: Partial<Gonderim> = {}): Gonderim => ({ id, zaman: "x", olay: "etutHatirlatma", veliId: VELI, alici: "a", ogrenciId: OGR, subeId: "s1", kanal: "push", metin: "m", durum: "bekliyor", maliyet: 0, ...p });
const gecmis = (p: Partial<Randevu> = {}) => randevu({ tarih: GECEN_SALI, ...p });

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
const reddedilir = (f: () => unknown, mesaj?: RegExp) => {
  expect(f).toThrow(YetkiHatasi);
  if (mesaj) expect(f).toThrow(mesaj);
};
const yeniRandevu = (r: Randevu, a?: Aktor, k?: Db) => dene((x) => x.randevular.push(r), a, k);
const durumYap = (r: Randevu, durum: Randevu["durum"], a?: Aktor, k: Db = { ...db, randevular: [r] }, ek?: (x: Db) => void) =>
  dene((x) => {
    x.randevular = x.randevular.map((y) => (y.id === r.id ? { ...y, durum } : y));
    ek?.(x);
  }, a, k);

describe("yetki ve modül", () => {
  it("yönetici randevu oluşturur; olusturan istemciden gelmez", () => {
    const t = yeniRandevu(randevu({ olusturan: "veli" }))();
    expect((t.koleksiyonlar.randevular!.yaz[0] as unknown as Randevu).olusturan).toBe("yonetim");
  });
  it("modül kapalıyken randevu, müsaitlik, paket yazılamaz; müsaitlik silinemez", () => {
    reddedilir(yeniRandevu(randevu(), YONETICI, KAPALI), /kapalı/);
    reddedilir(dene((x) => x.musaitlikler.push({ ...mu, id: "m2", gun: 3 }), YONETICI, KAPALI), /kapalı/);
    reddedilir(dene((x) => (x.musaitlikler = []), YONETICI, KAPALI), /kapalı/);
    reddedilir(dene((x) => x.paketler.push(paket()), YONETICI, KAPALI), /kapalı/);
  });
  it("modül kapalıyken etüt bildirimi kuyruğa girmez", () => {
    const t = dene((x) => x.gonderimler.push(gonderim("g1")), YONETICI, KAPALI)();
    expect(t.koleksiyonlar.gonderimler!.yaz).toEqual([]);
  });
  it("öğretmen kendi grubundaki öğrenciye kendi slotunda randevu verir", () => expect(yeniRandevu(randevu(), OGRETMEN)).not.toThrow());
  it("öğretmen başka grubun öğrencisine veya başkası adına randevu veremez", () => {
    reddedilir(yeniRandevu(randevu({ ogrenciIds: [BASKA] }), OGRETMEN), /kendi grup/);
    reddedilir(yeniRandevu(randevu({ ogretmenId: "p7" }), OGRETMEN), /kendi kayıt/);
  });
  it("öğretmen başkasının müsaitliğini ekleyemez, silemez", () => {
    reddedilir(dene((x) => x.musaitlikler.push({ ...mu, id: "m2", ogretmenId: "p7", gun: 3 }), OGRETMEN), /kendi kayıt/);
    const k = { ...db, musaitlikler: [{ ...mu, ogretmenId: "p7" }] };
    reddedilir(dene((x) => (x.musaitlikler = []), OGRETMEN, k), /kendi kayıt/);
  });
  it("şube müdürü başka şubeye yazamaz", () => reddedilir(yeniRandevu(randevu({ subeId: "s2", ogrenciIds: [S2_OGR] }), MUDUR), /kapsam/));
});

describe("randevu kuralları sunucuda", () => {
  it("müsaitlik dışı ve geçmiş reddedilir", () => {
    reddedilir(yeniRandevu(randevu({ bas: "18:00", bit: "18:40" })), /müsaitlik/);
    reddedilir(yeniRandevu(randevu({ tarih: GECEN_SALI })), /Geçmiş/);
  });
  it("aynı pakette iki randevu aynı saate yazılamaz", () => {
    reddedilir(dene((x) => x.randevular.push(randevu({ id: "r1" }), randevu({ id: "r2", ogrenciIds: [OGR2] }))), /doldu/);
  });
  it("öğretmenin başka şubedeki randevusu çakışır", () => {
    const k = { ...db, randevular: [randevu({ id: "r9", subeId: "s2", ogrenciIds: [S2_OGR] })] };
    reddedilir(yeniRandevu(randevu(), MUDUR, k), /doldu/);
  });
  it("randevu silinemez", () => {
    const r = randevu();
    reddedilir(dene((x) => (x.randevular = []), YONETICI, { ...db, randevular: [r] }), /silinemez/);
  });
  it("sonuçlanmış randevu ve başka alan değişmez", () => {
    const y = gecmis({ durum: "yapildi" });
    reddedilir(durumYap(y, "gelmedi"), /Sonuçlanmış/);
    const r = randevu();
    reddedilir(dene((x) => (x.randevular = [{ ...r, bas: "14:40", bit: "15:20" }]), MUDUR, { ...db, randevular: [r] }), /değiştirilemez/);
  });
  it("gelecekteki randevu yapıldı sayılamaz", () => reddedilir(durumYap(randevu(), "yapildi"), /Başlamamış/));
});

describe("paket hakkı sunucuda", () => {
  const paketli = (r: Randevu, p: Paket = paket(), ayar = false): Db => ({ ...db, randevular: [r], paketler: [p], ayarlar: { ...db.ayarlar, gelmeyenHakDussun: ayar } });
  const kalan = (t: ReturnType<ReturnType<typeof dene>>) => (t.koleksiyonlar.paketler!.yaz[0] as unknown as Paket).kalan;
  it("yapıldı: hak istemci göndermese de sunucuda düşer", () => {
    const r = gecmis({ paketId: "pkX" });
    expect(kalan(durumYap(r, "yapildi", MUDUR, paketli(r))())).toBe(1);
  });
  it("istemcinin bayat değeri esas alınmaz", () => {
    const r = gecmis({ paketId: "pkX" });
    const t = durumYap(r, "yapildi", MUDUR, paketli(r), (x) => (x.paketler = [{ ...x.paketler[0], kalan: 99 }]))();
    expect(kalan(t)).toBe(1);
    expect(t.koleksiyonlar.paketler!.yaz).toHaveLength(1);
  });
  it("gelmedi ayara göre", () => {
    const r = gecmis({ paketId: "pkX" });
    expect(durumYap(r, "gelmedi", MUDUR, paketli(r))().koleksiyonlar.paketler).toBeUndefined();
    expect(kalan(durumYap(r, "gelmedi", MUDUR, paketli(r, paket(), true))())).toBe(1);
  });
  it("öğretmen kendi randevusunu sonuçlandırınca hak düşer (paket satamaz)", () => {
    const r = gecmis({ paketId: "pkX" });
    const t = durumYap(r, "yapildi", OGRETMEN, paketli(r), (x) => (x.paketler = [{ ...x.paketler[0], kalan: 1, fiyat: 0 }]))();
    expect(t.koleksiyonlar.paketler!.yaz[0]).toMatchObject({ kalan: 1, fiyat: 900 });
    reddedilir(dene((x) => x.paketler.push(paket({ id: "pkY" })), OGRETMEN), /paket satışı/);
  });
  it("kalan hak randevusuz değişmez, tanım değişmez", () => {
    const k = { ...db, paketler: [paket()] };
    reddedilir(dene((x) => (x.paketler = [paket({ kalan: 40 })]), MUDUR, k), /Kalan hak/);
    reddedilir(dene((x) => (x.paketler = [paket({ toplam: 40 })]), MUDUR, k), /tanımı/);
  });
  const satis = (p: Paket, taksit = true, kaynak: Db = db) =>
    dene((x) => {
      x.paketler.push(p);
      if (taksit) x.taksitler.push({ id: "tkY", kayitId: aktifKayit(db, OGR)!.id, ogrenciId: OGR, veliId: VELI, subeId: "s1", no: 99, vade: BUGUN, tutar: p.fiyat, odenen: 0 });
    }, YONETICI, kaynak);
  it("yeni paket: kalan = toplam, tarih sunucudan; ücret ödeme planına eklenmeli", () => {
    expect(satis(paket({ kalan: 77, tarih: "2020-01-01", toplam: 8 }))().koleksiyonlar.paketler!.yaz[0]).toMatchObject({ kalan: 8, tarih: BUGUN });
    reddedilir(satis(paket(), false), /ödeme planına/);
  });
  it("finans kapalıyken paket ücretsiz, taksit gerekmez", () => {
    const k = { ...db, moduller: { ...db.moduller, finans: false } };
    expect(satis(paket(), false, k)().koleksiyonlar.paketler!.yaz[0]).toMatchObject({ fiyat: 0 });
  });
  it("geçersiz paket", () => {
    reddedilir(satis(paket({ toplam: 0 })), /hakkı/);
    reddedilir(satis(paket({ ogrenciId: S2_OGR, fiyat: 0 }), false) && dene((x) => x.paketler.push(paket({ ogretmenId: "yok", fiyat: 0 })), YONETICI), /aktif değil/);
  });
});

describe("bildirim", () => {
  it("onay yeni randevuya bağlanır, aynı veliye ikinci kopya düşer", () => {
    const t = dene((x) => {
      x.randevular.push(randevu());
      x.gonderimler.push(gonderim("g1"), gonderim("g2"));
    })();
    expect(t.koleksiyonlar.gonderimler!.yaz).toHaveLength(1);
    expect(t.koleksiyonlar.gonderimler!.yaz[0]).toMatchObject({ randevuId: "rX" });
  });
  it("karşılığı olmayan bildirim düşer", () => expect(dene((x) => x.gonderimler.push(gonderim("g1")))().koleksiyonlar.gonderimler!.yaz).toEqual([]));
  it("SMS izni kapalı veliye SMS gitmez", () => {
    const k = { ...db, veliler: db.veliler.map((v) => (v.id === VELI ? { ...v, izinSms: false } : v)) };
    const t = dene((x) => {
      x.randevular.push(randevu());
      x.gonderimler.push(gonderim("g1", { kanal: "sms", maliyet: 2 }));
    }, MUDUR, k)();
    expect(t.koleksiyonlar.gonderimler!.yaz[0]).toMatchObject({ kanal: "push", maliyet: 0 });
  });
  it("hatırlatma otomasyonu SMS iznine uyar, bir kez üretir, iptali atlar", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-09T12:00:00Z"));
    model.zamaniGuncelle();
    try {
      const bas = `${String(Number(model.SIMDI.slice(0, 2)) + 1).padStart(2, "0")}:${model.SIMDI.slice(3)}`;
      const r = { ...randevu({ tarih: model.BUGUN, bas, bit: "23:00" }) };
      const k: Db = { ...db, randevular: [r, { ...r, id: "rI", durum: "iptal" }], veliler: db.veliler.map((v) => (v.id === VELI ? { ...v, izinSms: false, pushAcik: false } : v)), olaylar: db.olaylar.map((o) => (o.key === "etutHatirlatma" ? { ...o, kanal: "sms" as typeof o.kanal } : o)), otomasyon: {} };
      const s1 = otomasyonlariCalistir(k);
      const giden = s1.gonderimler.filter((g) => g.olay === "etutHatirlatma");
      expect(giden).toHaveLength(1);
      expect(giden[0]).toMatchObject({ kanal: "push", maliyet: 0 });
      expect(otomasyonlariCalistir(s1).gonderimler.filter((g) => g.olay === "etutHatirlatma")).toHaveLength(1);
    } finally {
      vi.useRealTimers();
      model.zamaniGuncelle();
    }
  });
});

describe("görünürlük", () => {
  const veri: Db = { ...db, musaitlikler: [mu, { ...mu, id: "m7", ogretmenId: "p7" }], randevular: [randevu(), randevu({ id: "r7", ogretmenId: "p7", ogrenciIds: [OGR2] }), randevu({ id: "rB", bas: "14:40", bit: "15:20", ogrenciIds: [BASKA] })], paketler: [paket(), paket({ id: "p7k", ogretmenId: "p7" })] };
  it("öğretmen yalnızca kendi randevu, müsaitlik ve paketini görür; paket ücreti gitmez", () => {
    const g = okumaSuz(veri, OGRETMEN, BUGUN);
    expect(g.randevular.map((r) => r.id).sort()).toEqual(["rB", "rX"]);
    expect(g.musaitlikler.map((m) => m.id)).toEqual(["mu1"]);
    expect(g.paketler.map((p) => [p.id, p.fiyat])).toEqual([["pkX", 0]]);
  });
  it("öğretmen randevusundaki başka grubun öğrencisini yalnızca adıyla görür", () => {
    const o = okumaSuz(veri, OGRETMEN, BUGUN).ogrenciler.find((x) => x.id === BASKA)!;
    expect(o.ad).toBeTruthy();
    expect(o).toMatchObject({ veliIds: [], saglikNotu: "", notlar: [] });
  });
  it("veli başka öğrenciyi görmez; öğretmenin dolu saatleri kimliksiz gelir", () => {
    const g = veliVerisi({ ...veri, program: ham.program.map((p) => ({ ...p, baslangic: "2026-09-01" })) }, VELI);
    const baskasi = g.randevular.find((r) => r.id === "rB")!;
    expect(baskasi).toMatchObject({ ogrenciIds: [], dersId: "" });
    expect(JSON.stringify(g.randevular)).not.toContain(BASKA);
    expect(g.doluSaatler!.some((s) => s.ogretmenId === "p4")).toBe(true);
    expect(Object.keys(g.doluSaatler![0]).sort()).toEqual(["bas", "baslangic", "bit", "bitis", "gun", "ogretmenId"]);
  });
  it("modül kapalıyken veli etüt verisi almaz", () => {
    const g = veliVerisi({ ...veri, moduller: { ...veri.moduller, etut: false } }, VELI);
    expect(g.randevular).toEqual([]);
    expect(g.paketler).toEqual([]);
    expect(g.doluSaatler).toEqual([]);
  });
});

describe("veli API", () => {
  process.env.PGLITE_DIZIN = "memory://";
  let app: Awaited<ReturnType<typeof uygulamaOlustur>>;
  let vt: Awaited<ReturnType<typeof baglan>>;
  beforeAll(async () => {
    vt = await baglan();
    app = await uygulamaOlustur({ vt, sms: new KonsolSms(), push: null, demo: true, uretim: false });
    app.durum.db.program = app.durum.db.program.filter((p) => p.ogretmenId !== "p5");
    app.durum.db.tatiller = [];
  }, 60_000);
  afterAll(() => undefined);

  const veliGiris = async (telefon: string) => {
    let cerez = "";
    const iste = async (yol: string, govde: unknown) => {
      const r = await app.app.request(yol, { method: "POST", headers: { "content-type": "application/json", cookie: cerez, "user-agent": "Chrome/130" }, body: JSON.stringify(govde) });
      const sc = r.headers.get("set-cookie");
      if (sc) cerez = sc.split(";")[0];
      return { durum: r.status, veri: (await r.json()) as { demoKod?: string; hata?: string } };
    };
    const k = await iste("/api/veli/kod", { telefon });
    await iste("/api/veli/giris", { telefon, kod: k.veri.demoKod });
    return iste;
  };
  /** Gerçek bugünden en az 14 gün sonraki ilk çarşamba: p5 müsaitliği örnek veride çarşamba */
  const carsamba = () => {
    let t = tarihEkle(model.BUGUN, 14);
    while (haftaGunu(t) !== 3) t = tarihEkle(t, 1);
    return t;
  };
  const ikiVeli = () => {
    const d = app.durum.db;
    const s1 = d.ogrenciler.filter((o) => o.durum === "aktif" && aktifKayit(d, o.id)?.subeId === "s1" && d.veliler.some((v) => v.id === o.birincilVeliId));
    const a = s1[0];
    const b = s1.find((o) => !o.veliIds.some((v) => a.veliIds.includes(v)))!;
    const tel = (o: typeof a) => d.veliler.find((v) => v.id === o.birincilVeliId)!.telefon;
    return { a, b, telA: tel(a), telB: tel(b) };
  };

  it("aynı anda gelen iki istekten yalnızca biri slotu alır; yazma kuyruğu yarışı önler", async () => {
    const { a, b, telA, telB } = ikiVeli();
    const [vA, vB] = [await veliGiris(telA), await veliGiris(telB)];
    const tarih = carsamba();
    const sonuclar = await Promise.all([
      vA("/api/veli/randevu", { ogrenciId: a.id, ogretmenId: "p5", tarih, bas: "14:00" }),
      vB("/api/veli/randevu", { ogrenciId: b.id, ogretmenId: "p5", tarih, bas: "14:00" }),
    ]);
    expect(sonuclar.map((s) => s.durum).sort()).toEqual([200, 409]);
    expect(app.durum.db.randevular.filter((r) => r.tarih === tarih && r.bas === "14:00" && r.durum !== "iptal")).toHaveLength(1);
  }, 30_000);

  it("başkasının çocuğu, başkasının randevusu, modül kapalı", async () => {
    const { a, b, telA, telB } = ikiVeli();
    const [vA, vB] = [await veliGiris(telA), await veliGiris(telB)];
    const tarih = tarihEkle(carsamba(), 7);
    expect((await vA("/api/veli/randevu", { ogrenciId: b.id, ogretmenId: "p5", tarih, bas: "14:40" })).durum).toBe(403);
    expect((await vA("/api/veli/randevu", { ogrenciId: a.id, ogretmenId: "p5", tarih, bas: "14:40" })).durum).toBe(200);
    const r = app.durum.db.randevular.find((x) => x.tarih === tarih && x.bas === "14:40")!;
    expect(r.olusturan).toBe("veli");
    expect(app.durum.db.gonderimler.some((g) => g.randevuId === r.id)).toBe(true);
    expect((await vB(`/api/veli/randevu/${r.id}/iptal`, {})).durum).toBe(404);
    expect((await vA(`/api/veli/randevu/${r.id}/iptal`, {})).durum).toBe(200);
    expect(app.durum.db.randevular.find((x) => x.id === r.id)!.durum).toBe("iptal");
    expect((await vA(`/api/veli/randevu/${r.id}/iptal`, {})).durum).toBe(400);
    app.durum.db.moduller = { ...app.durum.db.moduller, etut: false };
    try {
      expect((await vA("/api/veli/randevu", { ogrenciId: a.id, ogretmenId: "p5", tarih, bas: "15:20" })).durum).toBe(403);
    } finally {
      app.durum.db.moduller = { ...app.durum.db.moduller, etut: true };
    }
  }, 30_000);
});
