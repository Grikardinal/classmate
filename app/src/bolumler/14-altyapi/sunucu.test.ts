/**
 * Bölüm 14'ün sunucu tarafı: yazma denetimi (politika.ts) ve API uçları (yedek, HTTP güvenliği, KVKK).
 * Gömülü PostgreSQL bellekte; yedek dosyaları geçici klasöre yazılır.
 */
import { mkdtempSync, rmSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { BUGUN, SURUM, ornekVeriUret, type Db } from "@/data/model";
import { farkHesapla, farkUygula, type Degisiklik } from "@/data/fark";
import { YetkiHatasi, yazmaDenetle, type Aktor } from "../../../server/politika";
import { baglan, hepsiniYukle, semaKur, tamamenYaz, type Veritabani } from "../../../server/veritabani";
import { KonsolSms } from "../../../server/gonderim";
import { DEMO_PAROLA, uygulamaOlustur } from "../../../server/uygulama";
import { yedekAl, yedekleriListele, yedekOku } from "../../../server/yedek";
import { ogrenciAnonimMi } from "../04-ogrenciler/kurallar";

process.env.PGLITE_DIZIN = "memory://";
process.env.NODE_ENV = "test";
const yedekDizin = mkdtempSync(join(tmpdir(), "classmate-yedek-"));
process.env.YEDEK_DIZIN = yedekDizin;
afterAll(() => rmSync(yedekDizin, { recursive: true, force: true }));

/* =========================== Yazma denetimi =========================== */
const db = ornekVeriUret();
const aktor = (id: string): Aktor => {
  const kullanici = db.kullanicilar.find((k) => k.id === id)!;
  return { kullanici, personel: db.personel.find((p) => p.id === kullanici.personelId)! };
};
const YONETICI = aktor("u0");
const SEKRETER = aktor(db.kullanicilar.find((k) => k.rol === "sekreter")!.id);
const ZAMAN = "2026-11-07T10:00";

function dene(fn: (x: Db) => void, a: Aktor = YONETICI, kaynak: Db = db) {
  const t = { ...kaynak } as Db;
  for (const k of Object.keys(t) as (keyof Db)[]) {
    const v = t[k];
    if (Array.isArray(v)) (t as Record<string, unknown>)[k] = [...v];
    else if (v && typeof v === "object") (t as Record<string, unknown>)[k] = { ...(v as object) };
  }
  fn(t);
  const f: Degisiklik = farkHesapla(kaynak, t);
  return () => yazmaDenetle(kaynak, farkUygula(kaynak, f), f, a, ZAMAN);
}
const reddedilir = (f: () => unknown, m: RegExp) => {
  expect(f).toThrow(YetkiHatasi);
  expect(f).toThrow(m);
};
const islem = (p: object = {}) => ({ id: "ik-t", zaman: "1999-01-01", kullanici: "Sahte", islem: "Kayıt", detay: "d", subeId: "s1", ...p });

describe("işlem kaydı", () => {
  it("kullanıcı ve zaman sunucudan; 'Sistem' adı taklit edilemez", () => {
    const t = dene((x) => x.islemler.unshift(islem({ kullanici: "Sistem" })))();
    expect(t.koleksiyonlar.islemler!.yaz[0]).toMatchObject({ kullanici: "Ahmet Er", zaman: ZAMAN });
    const u = dene((x) => x.islemler.unshift(islem({ kullanici: "Sistem", islem: "Devamsızlık uyarısı" })))();
    expect(u.koleksiyonlar.islemler!.yaz[0].kullanici).toBe("Sistem");
  });
  it("değiştirilemez ve silinemez", () => {
    reddedilir(dene((x) => (x.islemler = x.islemler.map((i, n) => (n === 0 ? { ...i, detay: "x" } : i)))), /değiştirilemez/);
    reddedilir(dene((x) => (x.islemler = x.islemler.slice(1))), /silinemez/);
  });
  it("kapsam dışı şubeye yazılamaz", () => {
    reddedilir(dene((x) => x.islemler.unshift(islem({ subeId: "s99" })), SEKRETER), /kapsam/);
  });
});

describe("KVKK ve aktarım kayıtları", () => {
  it("başvuru kaydı değiştirilemez, zaman sunucudan", () => {
    expect(dene((x) => x.kvkk.unshift({ id: "kv-t", zaman: "1999", kisi: "A***", tur: "bilgi", durum: "tamamlandi", not: "" }))().koleksiyonlar.kvkk!.yaz[0].zaman).toBe(ZAMAN);
    reddedilir(dene((x) => (x.kvkk = x.kvkk.map((k) => ({ ...k, not: "x" })))), /değiştirilemez/);
  });
  it("ayarlar sınırlı", () => {
    reddedilir(dene((x) => (x.ayarlar = { ...x.ayarlar, saklamaAyAday: 0 })), /Aday saklama/);
    expect(dene((x) => (x.ayarlar = { ...x.ayarlar, saklamaAyAday: 6 }))).not.toThrow();
    reddedilir(dene((x) => (x.ayarlar = { ...x.ayarlar, saklamaAyAday: 6 }), SEKRETER), /yalnızca genel yönetici/);
  });
});

describe("içe aktarma paketi", () => {
  const sezon = db.sezonlar.find((z) => z.aktif)!.id;
  const g = db.gruplar.find((x) => x.subeId === "s1" && x.sezonId === sezon)!;
  const veli = { id: "v-ia", ad: "Veli", soyad: "Ak", telefon: "0533 444 55 66", eposta: "", yakinlik: "Diğer" as const, pushAcik: false, portalDavet: "bekliyor" as const, izinSms: true, izinTanitim: false };
  const ogr = { id: "o-ia", ad: "Mert", soyad: "Ak", dogum: "", cinsiyet: "K" as const, okul: "", okulSinifi: "", saglikNotu: "", veliIds: ["v-ia"], birincilVeliId: "v-ia", durum: "aktif" as const, notlar: [], iceAktarmaId: "ia1" };
  const kayit = { id: "k-ia", ogrenciId: "o-ia", sezonId: sezon, subeId: "s1", grupId: g.id, sozlesmeNo: "MRK-2026-9901", durum: "aktif" as const, tarih: BUGUN, grupGecmisi: [{ grupId: g.id, tarih: BUGUN }], ekHizmetler: [], kvkkOnay: null, listeFiyati: 0, indirimler: [], net: 0, iceAktarmaId: "ia1" };
  const parti = { id: "ia1", zaman: "1999", dosya: "a.csv", ogrenciIds: ["o-ia"], veliIds: ["v-ia"], kayitIds: ["k-ia"], atlanan: 0, geriAlindi: false };
  const aktarilmis = (): Db => {
    const d = structuredClone(db);
    d.veliler.push(veli);
    d.ogrenciler.push(ogr);
    d.kayitlar.push(kayit);
    d.iceAktarmalar.push(parti);
    return d;
  };

  it("parti aynı paketteyse kaynak bilgisi korunur, yoksa silinir (ücretsiz kayıt istisnası)", () => {
    const kaynak = { ...db, moduller: { ...db.moduller, finans: true } };
    const t = dene((x) => {
      x.veliler.push(veli);
      x.ogrenciler.push(ogr);
      x.kayitlar.push(kayit);
      x.iceAktarmalar.push(parti);
    }, YONETICI, kaynak)();
    expect(t.koleksiyonlar.kayitlar!.yaz[0].iceAktarmaId).toBe("ia1");
    expect(t.koleksiyonlar.iceAktarmalar!.yaz[0].zaman).toBe(ZAMAN);
    const u = dene((x) => {
      x.veliler.push(veli);
      x.ogrenciler.push(ogr);
      x.kayitlar.push(kayit);
    }, YONETICI, kaynak)();
    expect(u.koleksiyonlar.kayitlar!.yaz[0].iceAktarmaId).toBeUndefined();
  });
  it("finans açıkken sahte iceAktarmaId ile sekreter ücretsiz kayıt açamaz", () => {
    const kaynak = { ...db, moduller: { ...db.moduller, finans: true } };
    const sezonluk = db.kullanicilar.find((k) => k.rol === "sekreter")!;
    const sube = sezonluk.subeIds === "all" ? "s1" : sezonluk.subeIds[0];
    const grup = db.gruplar.find((x) => x.subeId === sube && x.sezonId === sezon)!;
    const f = dene((x) => {
      x.veliler.push(veli);
      x.ogrenciler.push(ogr);
      x.kayitlar.push({ ...kayit, subeId: sube, grupId: grup.id, grupGecmisi: [{ grupId: grup.id, tarih: BUGUN }], sozlesmeNo: `${db.subeler.find((s) => s.id === sube)!.kod}-2026-9902` });
    }, SEKRETER, kaynak);
    expect(f).toThrow(YetkiHatasi);
  });
  it("geri alma: yalnızca aynı pakette parti işaretlenirse satırlar silinir", () => {
    const d = aktarilmis();
    expect(dene((x) => {
      x.ogrenciler = x.ogrenciler.filter((o) => o.id !== "o-ia");
      x.kayitlar = x.kayitlar.filter((k) => k.id !== "k-ia");
      x.veliler = x.veliler.filter((v) => v.id !== "v-ia");
      x.iceAktarmalar = x.iceAktarmalar.map((p) => (p.id === "ia1" ? { ...p, geriAlindi: true } : p));
    }, YONETICI, d)).not.toThrow();
    reddedilir(dene((x) => {
      x.ogrenciler = x.ogrenciler.filter((o) => o.id !== "o-ia");
      x.kayitlar = x.kayitlar.filter((k) => k.id !== "k-ia");
    }, YONETICI, d), /silinemez/);
  });
  it("aktarımdan sonra yoklama girildiyse geri alınamaz", () => {
    const d = aktarilmis();
    d.yoklamalar = { ...d.yoklamalar, x_1: { oturumId: "x_1", tarih: BUGUN, satirId: "x", grupId: g.id, ogretmenId: "p1", durumlar: { "o-ia": "geldi" as never }, konu: "", kayitZamani: ZAMAN } };
    reddedilir(dene((x) => {
      x.ogrenciler = x.ogrenciler.filter((o) => o.id !== "o-ia");
      x.kayitlar = x.kayitlar.filter((k) => k.id !== "k-ia");
      x.iceAktarmalar = x.iceAktarmalar.map((p) => (p.id === "ia1" ? { ...p, geriAlindi: true } : p));
    }, YONETICI, d), /geri alınamaz/);
  });
  it("çocuğu olmayan herhangi bir veli silinemez", () => {
    const d = structuredClone(db);
    d.veliler.push({ ...veli, id: "v-yalniz" });
    reddedilir(dene((x) => (x.veliler = x.veliler.filter((v) => v.id !== "v-yalniz")), YONETICI, d), /silinemez/);
  });
});

/* =========================== Yedek dosyaları =========================== */
describe("yedek dosyaları", () => {
  it("yazılır, listelenir, okunur; geçici dosya kalmaz; yol geçişi okunmaz", async () => {
    const ad = await yedekAl(db);
    expect((await yedekleriListele()).map((y) => y.ad)).toContain(ad);
    expect(await yedekOku(ad)).toContain('"kurum"');
    expect(readdirSync(yedekDizin).some((a) => a.endsWith(".tmp"))).toBe(false);
    writeFileSync(join(yedekDizin, "..", "gizli-classmate.json"), "x");
    expect(await yedekOku("../gizli-classmate.json")).toBeNull();
    rmSync(join(yedekDizin, "..", "gizli-classmate.json"));
  });
});

/* =========================== Veritabanı atomikliği =========================== */
describe("tamamenYaz", () => {
  it("yazma hatasında eski veri korunur (tek işlem)", async () => {
    const vt: Veritabani = await baglan();
    await semaKur(vt);
    const d = ornekVeriUret();
    await tamamenYaz(vt, d, () => null);
    // Yazılamayan satır (döngüsel nesne) silme adımından sonra hata verir: işlem geri alınmalı
    const dongu: Record<string, unknown> = { id: "dongu" };
    dongu.kendi = dongu;
    await expect(tamamenYaz(vt, { ...d, ogrenciler: [dongu as never] }, () => null)).rejects.toThrow();
    const y = await hepsiniYukle(vt);
    expect(y?.ogrenciler.length).toBe(d.ogrenciler.length);
    expect(y?.kurum.ad).toBe(d.kurum.ad);
    await vt.kapat();
  }, 60_000);
});

/* =========================== API =========================== */
const JSON_BASLIK = { "content-type": "application/json" };

describe("API", () => {
  let u: Awaited<ReturnType<typeof uygulamaOlustur>>;
  let vt: Veritabani;
  let cerez = "";
  let sonCerez = "";
  const sms = new KonsolSms();
  const iste = async (yol: string, govde?: unknown, ek: Record<string, string> = {}) => {
    const r = await u.app.request(yol, { method: govde === undefined ? "GET" : "POST", headers: { ...(govde === undefined ? {} : JSON_BASLIK), cookie: cerez, ...ek }, body: govde === undefined ? undefined : typeof govde === "string" ? govde : JSON.stringify(govde) });
    const metin = await r.text();
    let veri: Record<string, unknown> = {};
    try { veri = JSON.parse(metin); } catch { /* */ }
    return { durum: r.status, veri, metin, baslik: r.headers, set: r.headers.get("set-cookie") };
  };
  const girisYap = async (eposta: string) => {
    cerez = "";
    let r = await iste("/api/giris", { eposta, parola: DEMO_PAROLA });
    if (r.veri.ikiAdim) r = await iste("/api/giris/dogrula", { gecici: r.veri.gecici, kod: r.veri.demoKod });
    expect(r.durum).toBe(200);
    sonCerez = r.set!;
    cerez = r.set!.split(";")[0];
  };
  const YON = () => u.durum.db.kullanicilar.find((k) => k.id === "u0")!.eposta;

  beforeAll(async () => {
    vt = await baglan();
    u = await uygulamaOlustur({ vt, sms, push: null, demo: true, uretim: false });
  }, 60_000);
  afterAll(async () => vt.kapat());
  beforeEach(async () => girisYap(YON()));

  it("güvenlik başlıkları ve önbellek yasağı", async () => {
    const r = await iste("/api/durum");
    expect(r.baslik.get("content-security-policy")).toMatch(/default-src 'self'.*frame-ancestors 'self'/);
    expect(r.baslik.get("x-content-type-options")).toBe("nosniff");
    expect(r.baslik.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(r.baslik.get("cache-control")).toBe("no-store");
  });
  it("oturum çerezi HttpOnly ve SameSite=Strict", async () => {
    expect(sonCerez).toMatch(/HttpOnly/);
    expect(sonCerez).toMatch(/SameSite=Strict/);
  });
  it("CSRF: JSON olmayan içerik türü reddedilir", async () => {
    const r = await u.app.request("/api/degisiklik", { method: "POST", headers: { "content-type": "text/plain; application/json", cookie: cerez }, body: JSON.stringify({ koleksiyonlar: {}, tekil: {} }) });
    expect(r.status).toBe(400);
  });
  it("bozuk gövde 400; biçimsiz paket 400; iç ayrıntı sızmaz", async () => {
    expect((await iste("/api/giris", "{bozuk")).durum).toBe(400);
    expect((await iste("/api/giris", "null")).durum).toBe(400);
    expect((await iste("/api/degisiklik", { koleksiyonlar: { ogrenciler: { yaz: 5 } }, tekil: {} })).durum).toBe(400);
    const r = await iste("/api/yedek", "{bozuk");
    expect(r.durum).toBe(400);
    expect(r.metin).not.toMatch(/Unexpected|at .*\.ts/);
  });
  it("beklenmeyen hata 500 ve genel mesaj döner", async () => {
    const hataliVt = { ...vt, q: async (sql: string, p?: unknown[]) => { if (sql.includes("select degistirmeli")) throw new Error("gizli ayrıntı"); return vt.q(sql, p); } };
    const v = await uygulamaOlustur({ vt: hataliVt, sms, push: null, demo: true, uretim: false });
    const hataKonsol = console.error;
    console.error = () => undefined;
    const r = await v.app.request("/api/ben", { headers: { cookie: cerez } });
    console.error = hataKonsol;
    expect(r.status).toBe(500);
    expect(await r.text()).not.toContain("gizli");
  }, 60_000);
  it("üretimde demo dışı /api/durum altyapı bilgisi vermez", async () => {
    process.env.ILK_YONETICI_PAROLA = "IlkParola2026";
    const vt2 = await baglan();
    const v = await uygulamaOlustur({ vt: vt2, sms, push: null, demo: false, uretim: true });
    const d = (await (await v.app.request("/api/durum")).json()) as Record<string, unknown>;
    expect(d.vt).toBeUndefined();
    expect(d.sms).toBeUndefined();
    expect(d.demoParola).toBeUndefined();
    expect((await v.app.request("/api/demo/sifirla", { method: "POST", headers: JSON_BASLIK, body: "{}" })).status).toBe(401);
    await vt2.kapat();
  }, 60_000);
  it("ilk kurulum parolasız başlamaz ve yarım veri bırakmaz", async () => {
    delete process.env.ILK_YONETICI_PAROLA;
    const vt2 = await baglan();
    await expect(uygulamaOlustur({ vt: vt2, sms, push: null, demo: false, uretim: true })).rejects.toThrow(/ILK_YONETICI_PAROLA/);
    await semaKur(vt2);
    expect(await hepsiniYukle(vt2)).toBeNull();
    await vt2.kapat();
  }, 60_000);

  describe("yedek uçları", () => {
    it("yalnızca genel yönetici", async () => {
      const sek = u.durum.db.kullanicilar.find((k) => k.rol === "sekreter")!;
      await girisYap(sek.eposta);
      expect((await iste("/api/yedek")).durum).toBe(403);
      expect((await iste("/api/yedek/liste")).durum).toBe(403);
      expect((await iste("/api/yedek/al", {})).durum).toBe(403);
      expect((await iste("/api/yedek/dosya/classmate-2026-11-09T03-00.json")).durum).toBe(403);
      expect((await iste("/api/yedek", {})).durum).toBe(403);
      expect((await iste("/api/demo/sifirla", {})).durum).toBe(403);
      expect((await iste("/api/kvkk/anonimlestir", { tur: "aday", ids: ["x"] })).durum).toBe(403);
      cerez = "";
      expect((await iste("/api/yedek")).durum).toBe(401);
    });
    it("yedekte parola özeti ve oturum yok; indirme işlem kaydına yazılır", async () => {
      const r = await iste("/api/yedek");
      expect(r.durum).toBe(200);
      expect(r.metin).not.toMatch(/scrypt\$|belirtec_ozet|vapid/);
      expect(u.durum.db.islemler.some((i) => i.islem === "Yedek" && i.detay === "Tam yedek bilgisayara indirildi")).toBe(true);
    });
    it("yol geçişi 404", async () => {
      expect((await iste("/api/yedek/dosya/..%2F..%2F.env")).durum).toBe(404);
      expect((await iste("/api/yedek/dosya/classmate-2026-11-09T03-00.json")).durum).toBe(404);
    });
    it("elle yedek alınıp indirilebilir", async () => {
      const ad = String((await iste("/api/yedek/al", {})).veri.ad);
      const r = await iste(`/api/yedek/dosya/${ad}`);
      expect(r.durum).toBe(200);
      expect(r.baslik.get("content-disposition")).toContain(ad);
    });
    it("bozuk yedek reddedilir, veri değişmez", async () => {
      const once = u.durum.db.ogrenciler.length;
      const tam = JSON.parse(JSON.stringify(u.durum.db));
      expect((await iste("/api/yedek", { surum: SURUM })).durum).toBe(400);
      expect((await iste("/api/yedek", { ...tam, kurum: undefined })).durum).toBe(400);
      expect((await iste("/api/yedek", { ...tam, ogrenciler: [{ ad: "x" }] })).durum).toBe(400);
      expect(u.durum.db.ogrenciler.length).toBe(once);
    });
    it("kendini dışarıda bırakan yedek reddedilir", async () => {
      const tam = JSON.parse(JSON.stringify(u.durum.db));
      tam.kullanicilar = tam.kullanicilar.filter((k: { id: string }) => k.id !== "u0");
      expect((await iste("/api/yedek", tam)).veri.hata).toMatch(/dışarıda/);
    });
    it("8 MB üstü geri yükleme gövdesi kabul edilir; genel sınır aynen", async () => {
      const tam = JSON.parse(JSON.stringify(u.durum.db));
      tam.islemler = [...tam.islemler, { id: "buyuk", zaman: "2026-01-01T00:00", kullanici: "x", islem: "x", detay: "y".repeat(9 * 1024 * 1024), subeId: null }];
      expect((await iste("/api/yedek", tam)).durum).toBe(200);
      expect((await iste("/api/giris", { eposta: "y".repeat(9 * 1024 * 1024), parola: "x" })).durum).toBe(413);
      tam.islemler = tam.islemler.filter((i: { id: string }) => i.id !== "buyuk");
      expect((await iste("/api/yedek", tam)).durum).toBe(200);
    }, 60_000);
    it("geri yükleme: önce yedek alır, veriyi yeniden yükler, KVKK silmesini korur", async () => {
      const yedek = JSON.parse(JSON.stringify(u.durum.db));
      const once = (await yedekleriListele()).length;
      const o = u.durum.db.ogrenciler.find((x) => x.durum === "aktif")!;
      expect((await iste("/api/kvkk/anonimlestir", { tur: "ogrenci", ids: [o.id] })).durum).toBe(200);
      expect((await iste("/api/yedek", yedek)).durum).toBe(200);
      expect(existsSync(yedekDizin)).toBe(true);
      expect((await yedekleriListele()).length).toBeGreaterThanOrEqual(Math.max(once, 1));
      expect(ogrenciAnonimMi(u.durum.db.ogrenciler.find((x) => x.id === o.id)!)).toBe(true);
      expect(u.durum.db.islemler.some((i) => /1 KVKK silmesi yeniden uygulandı/.test(i.detay))).toBe(true);
    }, 60_000);
  });

  describe("KVKK anonimleştirme ucu", () => {
    it("aktif çocuklu veli 409; geçersiz istek 400", async () => {
      const o = u.durum.db.ogrenciler.find((x) => x.durum === "aktif" && !ogrenciAnonimMi(x))!;
      expect((await iste("/api/kvkk/anonimlestir", { tur: "veli", ids: [o.veliIds[0]] })).durum).toBe(409);
      expect((await iste("/api/kvkk/anonimlestir", { tur: "x", ids: ["a"] })).durum).toBe(400);
      expect((await iste("/api/kvkk/anonimlestir", { tur: "aday", ids: [] })).durum).toBe(400);
    });
    it("veli: push aboneliği ve oturumları silinir; değişiklik kalıcıdır", async () => {
      const db2 = u.durum.db;
      const v = db2.veliler.find((x) => !db2.ogrenciler.some((o) => o.veliIds.includes(x.id) && o.durum === "aktif"))
        ?? (await (async () => {
          const o = db2.ogrenciler.find((x) => x.durum === "aktif" && !ogrenciAnonimMi(x) && !db2.ogrenciler.some((y) => y.id !== x.id && y.veliIds.includes(x.veliIds[0])) && x.veliIds.length === 1)!;
          await iste("/api/kvkk/anonimlestir", { tur: "ogrenci", ids: [o.id] });
          return u.durum.db.veliler.find((x) => x.id === o.veliIds[0])!;
        })());
      await vt.q("insert into push_abonelik (endpoint, veli_id, abonelik) values ($1, $2, $3) on conflict do nothing", ["https://x/test", v.id, "{}"]);
      await vt.q("insert into oturum (belirtec_ozet, tur, sahip_id, bitis) values ($1, 'veli', $2, now() + interval '1 hour')", ["ozet-t", v.id]);
      expect((await iste("/api/kvkk/anonimlestir", { tur: "veli", ids: [v.id] })).durum).toBe(200);
      expect(await vt.q("select 1 from push_abonelik where veli_id = $1", [v.id])).toHaveLength(0);
      expect(await vt.q("select 1 from oturum where sahip_id = $1 and tur = 'veli'", [v.id])).toHaveLength(0);
      const kalici = await hepsiniYukle(vt);
      expect(kalici!.veliler.find((x) => x.id === v.id)!.telefon).toContain("***");
    }, 60_000);
  });

  it("günlük yedek otomasyon başarısızlıkta tekrar dener (gün işaretlenmez)", async () => {
    const eski = process.env.YEDEK_DIZIN;
    const dosya = join(yedekDizin, "dosya-engel");
    writeFileSync(dosya, "x");
    process.env.YEDEK_DIZIN = join(dosya, "alt"); // mkdir başarısız olur
    const model = await import("@/data/model");
    const saat = model.SIMDI;
    if (saat >= "03:00") {
      await expect(u.gunlukYedek()).rejects.toThrow();
      process.env.YEDEK_DIZIN = eski;
      await expect(u.gunlukYedek()).resolves.toBeUndefined();
    } else process.env.YEDEK_DIZIN = eski;
    rmSync(dosya);
  });
});
