/**
 * Bölüm 02'nin sunucu tarafı:
 * 1) server/politika.ts · yazmaDenetle → kullaniciDenetle (veritabanı açmadan, örnek veri + değişiklik paketi)
 * 2) server/uygulama.ts uçları (giriş, iki adım, parola, oturum) — gömülü PostgreSQL (bellekte), konsol SMS
 */
import { beforeAll, describe, expect, it } from "vitest";
import { ornekVeriUret, type Db, type Kullanici } from "@/data/model";
import { farkHesapla, farkUygula, type Degisiklik } from "@/data/fark";
import { YetkiHatasi, yazmaDenetle, type Aktor } from "../../../server/politika";
import { baglan } from "../../../server/veritabani";
import { KonsolSms } from "../../../server/gonderim";
import { DEMO_PAROLA, uygulamaOlustur } from "../../../server/uygulama";

process.env.PGLITE_DIZIN = "memory://";
process.env.NODE_ENV = "test";

/* =========================== 1) Yazma denetimi =========================== */
const db = ornekVeriUret();
const aktor = (kullaniciId: string, kaynak: Db = db): Aktor => {
  const kullanici = kaynak.kullanicilar.find((k) => k.id === kullaniciId)!;
  return { kullanici, personel: kaynak.personel.find((p) => p.id === kullanici.personelId)! };
};
const YONETICI = aktor("u0");
const ELIF = aktor("u1"); // şube müdürü · s1 · varsayılan yetkide 13 var, 02 yok

/** store.guncelle benzeri: taslak → fark → sunucu denetimi; temizlenmiş paketi döndürür */
function dene(fn: (x: Db) => void, a: Aktor = YONETICI, kaynak: Db = db) {
  const taslak = { ...kaynak } as Db;
  for (const k of Object.keys(taslak) as (keyof Db)[]) {
    const v = taslak[k];
    if (Array.isArray(v)) (taslak as Record<string, unknown>)[k] = [...v];
    else if (v && typeof v === "object") (taslak as Record<string, unknown>)[k] = { ...(v as object) };
  }
  fn(taslak);
  const fark: Degisiklik = farkHesapla(kaynak, taslak);
  return () => yazmaDenetle(kaynak, farkUygula(kaynak, fark), fark, a, "2026-11-07T10:00");
}
const reddedilir = (f: () => unknown, mesaj?: RegExp) => {
  expect(f).toThrow(YetkiHatasi);
  if (mesaj) expect(f).toThrow(mesaj);
};
const kullaniciGuncelle = (id: string, p: Partial<Kullanici>) => (x: Db) =>
  (x.kullanicilar = x.kullanicilar.map((k) => (k.id === id ? { ...k, ...p } : k)));
const yazilanKullanicilar = (t: Degisiklik) => (t.koleksiyonlar.kullanicilar?.yaz ?? []) as unknown as Kullanici[];

/** Bölüm 02 yetkisi verilmiş kopya veri */
function yetkili(rol: "sube-muduru" | "sekreter") {
  const v = structuredClone(db);
  v.rolYetkileri[rol]["02"] = true;
  return v;
}

describe("yetki yükseltme", () => {
  it("şube müdürü genel yönetici yetkisi veremez (13 yetkisiyle de)", () => {
    reddedilir(dene(kullaniciGuncelle("u9", { rol: "genel-yonetici", subeIds: "all" }), ELIF)); // "tüm şubeler" kapsamı da reddedilir
    reddedilir(dene(kullaniciGuncelle("u9", { rol: "genel-yonetici" }), ELIF), /Genel yönetici/);
    reddedilir(dene(kullaniciGuncelle("u9", { rol: "sube-muduru", ikiAdim: false }), aktor("u4")), /yetkiniz yok/); // öğretmen: 02/13 yok
  });
  it("02 yetkili sekreter kendinden yetkili rol atayamaz, üstündeki hesabı değiştiremez", () => {
    const v = yetkili("sekreter");
    const GUL = aktor("u9", v);
    reddedilir(dene(kullaniciGuncelle("u4", { rol: "sube-muduru" }), GUL, v), /yetkili bir rol/);
    reddedilir(dene(kullaniciGuncelle("u1", { ikiAdim: true }), GUL, v), /yetkili bir hesab/);
    expect(dene(kullaniciGuncelle("u4", { ikiAdim: true }), GUL, v)).not.toThrow();
  });
  it("şube müdürü kendi kapsamındaki sekreteri müdür yapabilir, başka şubeye atayamaz", () => {
    expect(dene(kullaniciGuncelle("u9", { rol: "sube-muduru" }), ELIF)).not.toThrow();
    reddedilir(dene(kullaniciGuncelle("u9", { subeIds: ["s1", "s2"] }), ELIF), /kapsam/);
  });
  it("kendi rolü, şube kapsamı ve aktifliği değiştirilemez; kendi hesabı silinemez", () => {
    reddedilir(dene(kullaniciGuncelle("u0", { rol: "sekreter", subeIds: ["s1"] })), /Kendi rolünüzü/);
    reddedilir(dene(kullaniciGuncelle("u0", { aktif: false })), /pasife/);
    const v = yetkili("sube-muduru");
    reddedilir(dene(kullaniciGuncelle("u1", { subeIds: [] }), aktor("u1", v), v));
    reddedilir(dene(kullaniciGuncelle("u10", { subeIds: ["s1"] }), aktor("u1", v), v), /kapsam/); // Emre (s2+s1)
    reddedilir(dene((x) => (x.kullanicilar = x.kullanicilar.filter((k) => k.id !== "u0"))));
  });
  it("son giriş zamanı istemciden yazılamaz", () => {
    const t = dene(kullaniciGuncelle("u9", { sonGiris: "2099-01-01T00:00", ikiAdim: true }))();
    expect(yazilanKullanicilar(t)[0].sonGiris).toBe(db.kullanicilar.find((k) => k.id === "u9")!.sonGiris);
  });
});

describe("son genel yönetici", () => {
  it("son aktif genel yönetici pasife alınamaz (başka bir aktör adına bile)", () => {
    const disaridan: Aktor = { ...YONETICI, kullanici: { ...YONETICI.kullanici, id: "uDis" } };
    reddedilir(dene(kullaniciGuncelle("u0", { aktif: false }), disaridan), /en az bir aktif genel yönetici/);
    reddedilir(dene(kullaniciGuncelle("u0", { rol: "sube-muduru", subeIds: ["s1"] }), disaridan), /en az bir aktif genel yönetici/);
  });
  it("ikinci genel yönetici varken diğeri pasife alınabilir", () => {
    const v = structuredClone(db);
    v.kullanicilar = v.kullanicilar.map((k) => (k.id === "u1" ? { ...k, rol: "genel-yonetici", subeIds: "all" } : k));
    expect(dene(kullaniciGuncelle("u0", { aktif: false }), aktor("u1", v), v)).not.toThrow();
  });
});

describe("kullanıcı satırı", () => {
  it("yinelenen e-posta reddedilir (büyük/küçük harf, Türkçe İ/I)", () => {
    reddedilir(dene(kullaniciGuncelle("u9", { eposta: "ELIF@ornekkurum.com" })), /başka bir kullanıcı/);
    reddedilir(dene(kullaniciGuncelle("u9", { eposta: "elİf@ornekkurum.com" })), /başka bir kullanıcı/);
  });
  it("e-posta küçük harfe çevrilip saklanır", () => {
    const t = dene(kullaniciGuncelle("u9", { eposta: "  GÜL.KOC@OrnekKurum.com " }))();
    expect(yazilanKullanicilar(t)[0].eposta).toBe("gül.koc@ornekkurum.com");
  });
  it("genel yönetici dışındaki role 'tüm şubeler' verilemez; personel kartı olmayan hesap açılamaz", () => {
    reddedilir(dene(kullaniciGuncelle("u9", { subeIds: "all" })), /En az bir/);
    reddedilir(dene((x) => x.kullanicilar.push({ ...x.kullanicilar[9], id: "uYeni", personelId: "pYok", eposta: "yeni@x.com" })), /personel/);
    reddedilir(dene((x) => x.kullanicilar.push({ ...x.kullanicilar[9], id: "uYeni", eposta: "yeni@x.com" })), /zaten bir kullanıcı/);
  });
});

describe("personel pasife alınınca hesap", () => {
  it("bağlı hesap da pasife alınır (hesabı görmeyen şube müdürü için de)", () => {
    const t = dene((x) => (x.personel = x.personel.map((p) => (p.id === "p9" ? { ...p, aktif: false } : p))), ELIF)();
    expect(yazilanKullanicilar(t)).toEqual([expect.objectContaining({ id: "u9", aktif: false })]);
  });
  it("kendi personel kartını pasife alamaz; yönetemediği hesabı pasife alamaz", () => {
    reddedilir(dene((x) => (x.personel = x.personel.map((p) => (p.id === "p1" ? { ...p, aktif: false } : p))), ELIF), /Kendi hesabınızı/);
    const v = structuredClone(db);
    v.personel = v.personel.map((p) => (p.id === "p0" ? { ...p, subeIds: ["s1"] } : p));
    reddedilir(dene((x) => (x.personel = x.personel.map((p) => (p.id === "p0" ? { ...p, aktif: false } : p))), aktor("u1", v), v), /yönetme yetkiniz yok/);
  });
});

describe("rol yetki tablosu", () => {
  it("genel yöneticinin bölümleri kapatılamaz, bozuk tablo reddedilir", () => {
    reddedilir(dene((x) => (x.rolYetkileri = { ...x.rolYetkileri, "genel-yonetici": { ...x.rolYetkileri["genel-yonetici"], "02": false } })), /kapatılamaz/);
    reddedilir(dene((x) => (x.rolYetkileri = { ...x.rolYetkileri, sekreter: { ...x.rolYetkileri.sekreter, "05": "evet" as unknown as boolean } })), /geçersiz/);
    expect(dene((x) => (x.rolYetkileri = { ...x.rolYetkileri, sekreter: { ...x.rolYetkileri.sekreter, "02": true } }))).not.toThrow();
  });
  it("şube müdürü (02 verilse bile) tabloyu değiştiremez", () => {
    const v = yetkili("sube-muduru");
    reddedilir(dene((x) => (x.rolYetkileri = { ...x.rolYetkileri, sekreter: { ...x.rolYetkileri.sekreter, "02": true } }), aktor("u1", v), v), /genel yönetici/);
  });
});

/* =========================== 2) API uçları =========================== */
let app: Awaited<ReturnType<typeof uygulamaOlustur>>;
let vt: Awaited<ReturnType<typeof baglan>>;
const sms = new KonsolSms();

beforeAll(async () => {
  vt = await baglan();
  app = await uygulamaOlustur({ vt, sms, push: null, demo: true, uretim: false });
}, 60_000);

/** Çerez saklayan küçük istemci; ip verilirse x-forwarded-for olarak gönderilir */
function istemci(ip?: string) {
  let cerez = "";
  return async (yol: string, govde?: unknown) => {
    const r = await app.app.request(yol, {
      method: govde === undefined ? "GET" : "POST",
      headers: { "content-type": "application/json", cookie: cerez, "user-agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/130", ...(ip ? { "x-forwarded-for": ip } : {}) },
      body: govde === undefined ? undefined : JSON.stringify(govde),
    });
    const sc = r.headers.get("set-cookie");
    if (sc) cerez = sc.split(";")[0];
    const metin = await r.text();
    return { durum: r.status, veri: metin ? JSON.parse(metin) : null, metin };
  };
}
async function giris(eposta: string, parola = DEMO_PAROLA) {
  const iste = istemci();
  const r = await iste("/api/giris", { eposta, parola });
  if (r.veri?.ikiAdim) expect((await iste("/api/giris/dogrula", { gecici: r.veri.gecici, kod: r.veri.demoKod })).durum).toBe(200);
  else expect(r.durum).toBe(200);
  return iste;
}
const degisiklik = (koleksiyonlar: Degisiklik["koleksiyonlar"], tekil: Degisiklik["tekil"] = {}) => ({ koleksiyonlar, tekil });

describe("giriş", () => {
  it("e-posta büyük harfle ve Türkçe 'I' ile yazılsa da eşleşir", async () => {
    const r = await istemci()("/api/giris", { eposta: "  SELIN@ORNEKKURUM.COM ", parola: DEMO_PAROLA });
    expect(r.durum).toBe(200);
    expect(r.veri.kullanici.id).toBe("u6");
  });
  it("parola özeti hiçbir yanıtta yer almaz", async () => {
    const iste = await giris("yonetim@ornekkurum.com");
    for (const yol of ["/api/ben", "/api/veri", "/api/yedek", "/api/durum"]) {
      const r = await iste(yol);
      expect(r.durum, yol).toBe(200);
      expect(r.metin, yol).not.toMatch(/scrypt\$|"ozet"/);
    }
  });
  it("x-forwarded-for değiştirilerek deneme sınırı aşılamaz (e-posta başına sınır)", async () => {
    let son = 0;
    for (let i = 0; i < 21; i++) son = (await istemci(`10.0.0.${i}`)("/api/giris", { eposta: "burak@ornekkurum.com", parola: "Yanlis0000" })).durum;
    expect(son).toBe(429);
  });
});

describe("iki adımlı doğrulama", () => {
  it("kod bir kez kullanılır; tekrar kullanılamaz", async () => {
    const iste = istemci();
    const r = await iste("/api/giris", { eposta: "yonetim@ornekkurum.com", parola: DEMO_PAROLA });
    expect((await iste("/api/giris/dogrula", { gecici: r.veri.gecici, kod: r.veri.demoKod })).durum).toBe(200);
    const tekrar = await istemci()("/api/giris/dogrula", { gecici: r.veri.gecici, kod: r.veri.demoKod });
    expect(tekrar.durum).toBe(401);
  });
  it("5 hatalı koddan sonra doğru kod da kabul edilmez", async () => {
    const iste = istemci();
    const r = await iste("/api/giris", { eposta: "yonetim@ornekkurum.com", parola: DEMO_PAROLA });
    for (let i = 0; i < 5; i++) await iste("/api/giris/dogrula", { gecici: r.veri.gecici, kod: r.veri.demoKod === "000000" ? "111111" : "000000" });
    const d = await iste("/api/giris/dogrula", { gecici: r.veri.gecici, kod: r.veri.demoKod });
    expect(d.durum).toBe(401);
    expect(d.veri.hata).toMatch(/Yeniden giriş/);
    // Başarılı ikinci adım sayaçları sıfırlar
    await giris("yonetim@ornekkurum.com");
  });
});

describe("oturumlar", () => {
  it("pasife alınan kullanıcının açık oturumu kapanır", async () => {
    const gul = await giris("gul@ornekkurum.com");
    expect((await gul("/api/ben")).durum).toBe(200);
    const yonetici = await giris("yonetim@ornekkurum.com");
    const u9 = app.durum.db.kullanicilar.find((k) => k.id === "u9")!;
    expect((await yonetici("/api/degisiklik", degisiklik({ kullanicilar: { yaz: [{ ...u9, aktif: false }], sil: [] } }))).durum).toBe(200);
    expect((await gul("/api/ben")).durum).toBe(401);
    expect(await vt.q("select 1 from oturum where tur = 'personel' and sahip_id = 'u9'")).toHaveLength(0);
  });
  it("şube müdürü personeli pasife alınca hesabı ve oturumu da kapanır", async () => {
    const ayse = await giris("ayse@ornekkurum.com");
    const elif = await giris("elif@ornekkurum.com");
    const p4 = app.durum.db.personel.find((p) => p.id === "p4")!;
    expect((await elif("/api/degisiklik", degisiklik({ personel: { yaz: [{ ...p4, aktif: false }], sil: [] } }))).durum).toBe(200);
    expect(app.durum.db.kullanicilar.find((k) => k.id === "u4")!.aktif).toBe(false);
    expect((await ayse("/api/ben")).durum).toBe(401);
    expect((await istemci()("/api/giris", { eposta: "ayse@ornekkurum.com", parola: DEMO_PAROLA })).veri.hata).toMatch(/pasif/);
  });
  it("parola değişince diğer oturumlar kapanır; aynı parola tekrar kullanılamaz", async () => {
    const bir = await giris("selin@ornekkurum.com");
    const iki = await giris("selin@ornekkurum.com");
    expect((await bir("/api/parola", { eski: DEMO_PAROLA, yeni: DEMO_PAROLA })).veri.hata).toMatch(/farklı/);
    expect((await bir("/api/parola", { eski: DEMO_PAROLA, yeni: "12345678!" })).durum).toBe(400);
    expect((await bir("/api/parola", { eski: DEMO_PAROLA, yeni: "SelinYeni2026" })).durum).toBe(200);
    expect((await bir("/api/ben")).durum).toBe(200);
    expect((await iki("/api/ben")).durum).toBe(401);
  });
  it("mevcut parola deneme-yanılmayla bulunamaz", async () => {
    const iste = await giris("deniz@ornekkurum.com");
    for (let i = 0; i < 5; i++) expect((await iste("/api/parola", { eski: `Yanlis${i}000`, yeni: "DenizYeni2026" })).durum).toBe(403);
    expect((await iste("/api/parola", { eski: DEMO_PAROLA, yeni: "DenizYeni2026" })).durum).toBe(429);
  });
});

describe("parola sıfırlama", () => {
  it("02 yetkisi olmayan şube müdürü sıfırlayamaz", async () => {
    const elif = await giris("elif@ornekkurum.com");
    expect((await elif("/api/kullanicilar/u6/parola-sifirla", {})).durum).toBe(403);
  });
  it("02 yetkili şube müdürü: kapsamındaki alt rolü sıfırlar; genel yöneticiyi, kapsam dışını ve kendini sıfırlayamaz", async () => {
    const yonetici = await giris("yonetim@ornekkurum.com");
    const t = structuredClone(app.durum.db.rolYetkileri);
    t["sube-muduru"]["02"] = true;
    expect((await yonetici("/api/degisiklik", degisiklik({}, { rolYetkileri: t }))).durum).toBe(200);
    const elif = await giris("elif@ornekkurum.com");
    expect((await elif("/api/kullanicilar/u6/parola-sifirla", {})).durum).toBe(200);
    expect((await elif("/api/kullanicilar/u0/parola-sifirla", {})).durum).toBe(403);
    expect((await elif("/api/kullanicilar/u10/parola-sifirla", {})).veri.hata).toMatch(/kapsam/);
    expect((await elif("/api/kullanicilar/u1/parola-sifirla", {})).veri.hata).toMatch(/Parola değiştir/);
  });
});

describe("iki adım kodu isteme sınırı", () => {
  it("doğru parolayla tekrar tekrar kod istenemez (ikinci adım tamamlanmadan sayaç sıfırlanmaz)", async () => {
    let son = 0;
    for (let i = 0; i < 6; i++) son = (await istemci(`10.1.0.${i}`)("/api/giris", { eposta: "yonetim@ornekkurum.com", parola: DEMO_PAROLA })).durum;
    expect(son).toBe(429);
  });
});
