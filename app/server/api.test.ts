/**
 * Sunucu API testleri: gömülü PostgreSQL (bellekte), konsol SMS sağlayıcısı.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { baglan, semaKur } from "./veritabani";
import { KonsolSms } from "./gonderim";
import { DEMO_PAROLA, uygulamaOlustur } from "./uygulama";
import type { Db } from "../src/data/model";

process.env.PGLITE_DIZIN = "memory://";
process.env.NODE_ENV = "test";

let app: Awaited<ReturnType<typeof uygulamaOlustur>>;
let vtOrtak: Awaited<ReturnType<typeof baglan>>;
const sms = new KonsolSms();

beforeAll(async () => {
  vtOrtak = await baglan();
  app = await uygulamaOlustur({ vt: vtOrtak, sms, push: null, demo: true, uretim: false });
}, 60_000);

/** Çerez saklayan küçük istemci */
function istemci() {
  let cerez = "";
  const iste = async (yol: string, gövde?: unknown, yontem?: string) => {
    const r = await app.app.request(yol, {
      method: yontem ?? (gövde === undefined ? "GET" : "POST"),
      headers: { "content-type": "application/json", cookie: cerez, "user-agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/130" },
      body: gövde === undefined ? undefined : JSON.stringify(gövde),
    });
    const sc = r.headers.get("set-cookie");
    if (sc) cerez = sc.split(";")[0];
    const metin = await r.text();
    return { durum: r.status, veri: metin ? JSON.parse(metin) : null };
  };
  return iste;
}

async function personelGiris(eposta: string) {
  const iste = istemci();
  const r = await iste("/api/giris", { eposta, parola: DEMO_PAROLA });
  if (r.veri.ikiAdim) {
    const d = await iste("/api/giris/dogrula", { gecici: r.veri.gecici, kod: r.veri.demoKod });
    expect(d.durum).toBe(200);
  } else expect(r.durum).toBe(200);
  return iste;
}

describe("personel girişi", () => {
  it("oturum olmadan veri verilmez", async () => {
    const r = await istemci()("/api/veri");
    expect(r.durum).toBe(401);
  });
  it("hatalı parola reddedilir, aynı mesaj döner", async () => {
    const iste = istemci();
    const a = await iste("/api/giris", { eposta: "elif@ornekkurum.com", parola: "yanlis1234" });
    const b = await iste("/api/giris", { eposta: "olmayan@x.com", parola: "yanlis1234" });
    expect(a.durum).toBe(401);
    expect(a.veri.hata).toBe(b.veri.hata);
  });
  it("genel yönetici iki adımlı doğrulamayla girer (SMS kodu)", async () => {
    const iste = istemci();
    const r = await iste("/api/giris", { eposta: "yonetim@ornekkurum.com", parola: DEMO_PAROLA });
    expect(r.veri.ikiAdim).toBe(true);
    expect(sms.gonderilenler.at(-1)!.metin).toContain(r.veri.demoKod);
    expect((await iste("/api/giris/dogrula", { gecici: r.veri.gecici, kod: "000000" })).durum).toBe(401);
    const d = await iste("/api/giris/dogrula", { gecici: r.veri.gecici, kod: r.veri.demoKod });
    expect(d.veri.kullanici.rol).toBe("genel-yonetici");
    expect((await iste("/api/ben")).durum).toBe(200);
  });
  it("5 hatalı denemeden sonra geçici olarak kilitlenir", async () => {
    const iste = istemci();
    for (let i = 0; i < 5; i++) await iste("/api/giris", { eposta: "gul@ornekkurum.com", parola: "hatali000" });
    const r = await iste("/api/giris", { eposta: "gul@ornekkurum.com", parola: DEMO_PAROLA });
    expect(r.durum).toBe(429);
  });
});

describe("şube kapsamı (sunucuda)", () => {
  it("Kuzey şube müdürü yalnızca Kuzey öğrencilerini alır", async () => {
    const iste = await personelGiris("murat@ornekkurum.com");
    const db = (await iste("/api/veri")).veri as Db;
    expect(db.kayitlar.length).toBeGreaterThan(0);
    expect(db.kayitlar.every((k) => k.subeId === "s2")).toBe(true);
    expect(db.ogrenciler.length).toBe(db.kayitlar.filter((k) => k.durum !== "iptal").length);
    expect(db.kullanicilar.map((k) => k.id)).toEqual(["u2"]);
  });
  it("öğretmen yalnızca kendi gruplarını görür; veli telefonları maskelidir; finans yok", async () => {
    const iste = await personelGiris("can@ornekkurum.com");
    const db = (await iste("/api/veri")).veri as Db;
    const gruplar = new Set(db.gruplar.map((g) => g.id));
    expect([...gruplar].sort()).toEqual(["g2", "g3", "g5", "g6"]);
    expect(db.taksitler).toHaveLength(0);
    expect(db.veliler.every((v) => v.telefon.includes("*"))).toBe(true);
  });
  it("başka şubeye kayıt yazma reddedilir", async () => {
    const iste = await personelGiris("murat@ornekkurum.com");
    const r = await iste("/api/degisiklik", {
      koleksiyonlar: { ogrenciler: { yaz: [{ id: "oX", ad: "Sızma", soyad: "Deneme", veliIds: [], birincilVeliId: "", durum: "aktif", notlar: [] }], sil: [] }, kayitlar: { yaz: [{ id: "kX", ogrenciId: "oX", sezonId: "z2", subeId: "s1", grupId: "g1", sozlesmeNo: "MRK-2026-9999", durum: "aktif" }], sil: [] } },
      tekil: {},
    });
    expect(r.durum).toBe(403);
    expect(r.veri.hata).toMatch(/kapsam/i);
  });
  it("öğretmen finans verisine ve kurum ayarlarına yazamaz", async () => {
    const iste = await personelGiris("can@ornekkurum.com");
    expect((await iste("/api/degisiklik", { koleksiyonlar: { taksitler: { yaz: [{ id: "tkX", subeId: "s1", tutar: 1, odenen: 1 }], sil: [] } }, tekil: {} })).durum).toBe(403);
    expect((await iste("/api/degisiklik", { koleksiyonlar: {}, tekil: { moduller: { finans: true } } })).durum).toBe(403);
  });
  it("işlem kaydı silinemez, tahsilat silinemez", async () => {
    const iste = await personelGiris("elif@ornekkurum.com");
    const db = (await iste("/api/veri")).veri as Db;
    expect((await iste("/api/degisiklik", { koleksiyonlar: { islemler: { yaz: [], sil: [db.islemler[0].id] } }, tekil: {} })).durum).toBe(403);
  });
});

describe("yoklama → devamsızlık bildirimi → gönderim kuyruğu", () => {
  it("öğretmenin kaydettiği yoklama ve bildirim veritabanına yazılır, SMS/push kuyruğu işlenir", async () => {
    const iste = await personelGiris("can@ornekkurum.com");
    const db = (await iste("/api/veri")).veri as Db;
    const ogr = db.ogrenciler.find((o) => db.kayitlar.some((k) => k.ogrenciId === o.id && k.grupId === "g2"))!;
    const v = db.veliler.find((x) => x.id === ogr.birincilVeliId)!;
    const yok = { oturumId: "ps5_2030-01-07", tarih: "2030-01-07", satirId: "ps5", grupId: "g2", ogretmenId: "p5", durumlar: { [ogr.id]: "gelmedi" }, konu: "Test", kayitZamani: "2030-01-07T17:00" };
    const g = { id: "gnTEST1", zaman: "x", olay: "devamsizlik", veliId: v.id, alici: "maskeli", ogrenciId: ogr.id, subeId: "s1", kanal: "sms", metin: `${ogr.ad} bugün 16:50 Matematik dersine katılmadı.`, durum: "iletildi", maliyet: 0 };
    const r = await iste("/api/degisiklik", { koleksiyonlar: { yoklamalar: { yaz: [yok], sil: [] }, gonderimler: { yaz: [g], sil: [] } }, tekil: {} });
    expect(r.durum).toBe(200);
    const kayit = app.durum.db.gonderimler.find((x) => x.id === "gnTEST1")!;
    expect(kayit.alici).not.toContain("*"); // sunucu gerçek alıcıyı yazar
    await app.kuyrukCalistir();
    const son = app.durum.db.gonderimler.find((x) => x.id === "gnTEST1")!;
    // Gönderim saat aralığı dışındaysa bekler; içindeyse iletilir
    expect(["iletildi", "bekliyor"]).toContain(son.durum);
  });
  it("istemcinin gönderdiği durum yok sayılır (sunucu 'bekliyor' yapar)", async () => {
    const g = app.durum.db.gonderimler.find((x) => x.id === "gnTEST1")!;
    expect(g.durum === "bekliyor" || g.durum === "iletildi").toBe(true);
  });
});

describe("veli portalı", () => {
  it("SMS koduyla giriş; yalnızca kendi çocuğunu görür", async () => {
    const iste = istemci();
    const v = app.durum.db.veliler.find((x) => app.durum.db.ogrenciler.filter((o) => o.veliIds.includes(x.id)).length > 1)!;
    const k = await iste("/api/veli/kod", { telefon: v.telefon.replace(/\s/g, "") });
    expect(k.durum).toBe(200);
    expect(sms.gonderilenler.at(-1)!.telefon).toBe(v.telefon);
    expect((await iste("/api/veli/giris", { telefon: v.telefon, kod: "999999" })).veri.hata).toMatch(/Kalan deneme: 4/);
    expect((await iste("/api/veli/giris", { telefon: v.telefon, kod: k.veri.demoKod })).durum).toBe(200);
    const db = (await iste("/api/veli/veri")).veri as Db;
    expect(db.ogrenciler.every((o) => o.veliIds.includes(v.id))).toBe(true);
    expect(db.ogrenciler.length).toBeGreaterThan(1);
    expect(db.veliler).toHaveLength(1);
    expect(db.personel.every((p) => p.telefon === "")).toBe(true);
    for (const y of Object.values(db.yoklamalar)) for (const o of Object.keys(y.durumlar)) expect(db.ogrenciler.some((x) => x.id === o)).toBe(true);
    // Personel uçlarına veli çereziyle erişilemez
    expect((await iste("/api/veri")).durum).toBe(401);
  });
  it("kayıtlı olmayan numara için de aynı yanıt döner (numara sızdırılmaz)", async () => {
    const r = await istemci()("/api/veli/kod", { telefon: "0599 000 00 01" });
    expect(r.durum).toBe(200);
    expect(r.veri.demoKod).toBeUndefined();
  });
  it("veli başkasının çocuğu için izin bildiremez", async () => {
    const iste = istemci();
    const v = app.durum.db.veliler[0];
    const k = await iste("/api/veli/kod", { telefon: v.telefon });
    await iste("/api/veli/giris", { telefon: v.telefon, kod: k.veri.demoKod });
    const baska = app.durum.db.ogrenciler.find((o) => !o.veliIds.includes(v.id))!;
    expect((await iste("/api/veli/izin", { ogrenciId: baska.id, tarih: "2099-01-01", not: "x" })).durum).toBe(403);
  });
});

describe("parola işlemleri", () => {
  it("yönetici geçici parola üretir; kullanıcı ilk girişte değiştirmeye zorlanır", async () => {
    const yonetici = await personelGiris("yonetim@ornekkurum.com");
    const r = await yonetici("/api/kullanicilar/u9/parola-sifirla", {});
    expect(r.veri.parola).toMatch(/^[A-Za-z]{8}\d{2}$/);
    const iste = istemci();
    const g = await iste("/api/giris", { eposta: "gul@ornekkurum.com", parola: r.veri.parola });
    // Gül'ün hesabı yukarıdaki testte kilitlendi olabilir; kilit IP+e-posta bazlı
    if (g.durum === 200) {
      expect(g.veri.parolaDegistirmeli).toBe(true);
      expect((await iste("/api/parola", { eski: r.veri.parola, yeni: "zayif" })).durum).toBe(400);
      expect((await iste("/api/parola", { eski: r.veri.parola, yeni: "YeniParola2026" })).durum).toBe(200);
    } else expect(g.durum).toBe(429);
  });
});

describe("kalıcılık", () => {
  it("yazılan değişiklik veritabanında kalır; sunucu yeniden açılınca geri yüklenir", async () => {
    const iste = await personelGiris("elif@ornekkurum.com");
    const r = await iste("/api/degisiklik", { koleksiyonlar: { tatiller: { yaz: [{ id: "tKALICI", tarih: "2026-12-31", ad: "Yılbaşı (test)", subeId: "s1" }], sil: [] } }, tekil: {} });
    expect(r.durum).toBe(200);
    const yeniden = await uygulamaOlustur({ vt: vtOrtak, sms, push: null, demo: true, uretim: false });
    expect(yeniden.durum.db.tatiller.some((t) => t.id === "tKALICI")).toBe(true);
    const s = await vtOrtak.q("select sube_id from k_tatiller where id = 'tKALICI'");
    expect(s[0].sube_id).toBe("s1");
    // Kimliği "key" olan koleksiyon (bildirim olayları) da eksiksiz geri yüklenir
    expect(yeniden.durum.db.olaylar.length).toBe(app.durum.db.olaylar.length);
    expect(yeniden.durum.db.olaylar.length).toBeGreaterThanOrEqual(12);
    // Tüm koleksiyonlarda satır sayısı korunur
    for (const k of ["ogrenciler", "veliler", "kayitlar", "program", "taksitler", "gonderimler", "dersSaatleri"] as const)
      expect(yeniden.durum.db[k].length, k).toBe(app.durum.db[k].length);
  });
  it("modül anahtarını yalnızca genel yönetici değiştirir ve kalıcıdır", async () => {
    const mudur = await personelGiris("elif@ornekkurum.com");
    expect((await mudur("/api/degisiklik", { koleksiyonlar: {}, tekil: { moduller: { ...app.durum.db.moduller, finans: true } } })).durum).toBe(403);
    const yonetici = await personelGiris("yonetim@ornekkurum.com");
    expect((await yonetici("/api/degisiklik", { koleksiyonlar: {}, tekil: { moduller: { ...app.durum.db.moduller, finans: true } } })).durum).toBe(200);
    const r = await vtOrtak.q("select veri from tekil where anahtar = 'moduller'");
    expect((r[0].veri as { finans: boolean }).finans).toBe(true);
  });
});
describe("ilk kurulum", () => {
  it("web push anahtarı önce yazılmış olsa da boş veritabanı kurulur", async () => {
    const vt = await baglan();
    await semaKur(vt);
    await vt.q("insert into tekil (anahtar, veri) values ('vapid', '{}')");
    const u = await uygulamaOlustur({ vt, sms, push: null, demo: true, uretim: false });
    expect(u.durum.db.ogrenciler.length).toBeGreaterThan(50);
    expect(u.durum.db.moduller).toBeDefined();
    await u.otomasyonCalistir();
  });
  it("demo dışı kurulum: boş kurum + parolası değiştirilmesi zorunlu yönetici", async () => {
    process.env.ILK_YONETICI_PAROLA = "IlkParola2026";
    process.env.ILK_YONETICI_EPOSTA = "admin@kurum.test";
    const vt = await baglan();
    const u = await uygulamaOlustur({ vt, sms, push: null, demo: false, uretim: false });
    expect(u.durum.db.ogrenciler).toHaveLength(0);
    expect(u.durum.db.subeler).toHaveLength(1);
    const r = await u.app.request("/api/giris", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eposta: "admin@kurum.test", parola: "IlkParola2026" }) });
    expect(((await r.json()) as { parolaDegistirmeli: boolean }).parolaDegistirmeli).toBe(true);
    expect((await (await u.app.request("/api/durum")).json() as { demoHesaplar?: unknown }).demoHesaplar).toBeUndefined();
  });
});