/**
 * Bölüm 11 sunucu denetimi: veliVerisi alan alan, giriş (numaralandırma, sınırlar, tek kullanım), oturum, çıkışta push aboneliği, yazma uçları.
 * Gerçek SMS gönderilmez (konsol sağlayıcı). Tarih karşılaştırmaları sunucunun kendi BUGUN değerinden türetilir.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ornekVeriUret, tanimKaynagi, type Db } from "@/data/model";
import { veliVerisi } from "../../../server/politika";
import { KonsolSms } from "../../../server/gonderim";
import { uygulamaOlustur } from "../../../server/uygulama";
import { baglan } from "../../../server/veritabani";

// Gerçek veri klasörüne (.veri) asla yazılmasın
process.env.PGLITE_DIZIN = "memory://";

const ham = ornekVeriUret();
tanimKaynagi(ham);
const db: Db = { ...ham, moduller: { ...ham.moduller, finans: true, etut: true, odev: true } };
const cocukVeli = db.ogrenciler.find((o) => o.durum === "aktif" && db.kayitlar.some((k) => k.ogrenciId === o.id))!;
const VELI = cocukVeli.birincilVeliId;

describe("veliVerisi", () => {
  const v = veliVerisi(db, VELI);
  const metin = JSON.stringify(v);
  it("yalnızca kendi velisi ve çocukları", () => {
    expect(v.veliler.map((x) => x.id)).toEqual([VELI]);
    expect(v.ogrenciler.length).toBeGreaterThan(0);
    for (const o of v.ogrenciler) expect(db.ogrenciler.find((x) => x.id === o.id)!.veliIds).toContain(VELI);
  });
  it("personel kişisel/ücret verisi gitmez", () => {
    for (const p of db.personel) {
      if (p.telefon) expect(metin).not.toContain(p.telefon);
      if (p.eposta) expect(metin).not.toContain(p.eposta);
    }
    for (const p of v.personel) expect(p).toMatchObject({ telefon: "", eposta: "", dersUcreti: 0, sabitUcret: 0, baslangic: "", subeIds: [], dersIds: [] });
  });
  it("öğrenci notu, sağlık notu gitmez", () => {
    for (const o of v.ogrenciler) {
      expect(o.notlar).toEqual([]);
      expect(o.saglikNotu).toBe("");
    }
  });
  it("boşanmış / ikinci veli: diğer velinin kimliği görünmez", () => {
    const eski = cocukVeli.veliIds;
    const k: Db = { ...db, ogrenciler: db.ogrenciler.map((o) => (o.id === cocukVeli.id ? { ...o, veliIds: [...eski, "diger"], birincilVeliId: "diger" } : o)), izinler: [{ id: "i", ogrenciId: cocukVeli.id, tarih: "2030-01-01", not: "n", veliId: "diger", olusturma: "x" }], taksitler: db.taksitler.map((t) => (t.ogrenciId === cocukVeli.id ? { ...t, veliId: "diger" } : t)) };
    const s = JSON.stringify(veliVerisi(k, VELI));
    expect(s).not.toContain('"diger"');
  });
  it("sözleşme fiyatı, indirim, iptal hesabı gitmez", () => {
    const k: Db = { ...db, kayitlar: db.kayitlar.map((x) => ({ ...x, bekleyenIndirim: { indirimler: [], isteyen: "Gizli Sekreter", zaman: "x" } })) };
    const y = veliVerisi(k, VELI);
    expect(JSON.stringify(y)).not.toContain("Gizli Sekreter");
    for (const x of y.kayitlar) expect(x).toMatchObject({ listeFiyati: 0, net: 0, indirimler: [], sozlesmeNo: "" });
  });
  it("kurum içi koleksiyonlar boş", () => {
    for (const a of ["kullanicilar", "girisler", "adaylar", "fiyatListesi", "tahsilatlar", "giderler", "virmanlar", "iadeler", "islemler", "iceAktarmalar", "kvkk", "avanslar", "olaylar"] as const) expect(v[a]).toEqual([]);
    expect(v.otomasyon).toEqual({});
    expect(v.hakedisDurum).toEqual({});
    expect(v.kurum.vergiNo).toBe("");
    expect(v.ayarlar.smsBirimFiyat).toBe(0);
  });
  it("yalnızca ilgili şubeler; müdür adı yok", () => {
    const kendi = new Set(db.kayitlar.filter((k) => v.ogrenciler.some((o) => o.id === k.ogrenciId)).map((k) => k.subeId));
    for (const s of v.subeler) {
      expect(kendi.has(s.id)).toBe(true);
      expect(s.mudur).toBe("");
    }
  });
  it("yoklamada başka öğrenci yok; çocuğun olmadığı oturum gelmez", () => {
    const ids = new Set(v.ogrenciler.map((o) => o.id));
    for (const y of Object.values(v.yoklamalar)) {
      expect(Object.keys(y.durumlar).length).toBeGreaterThan(0);
      for (const o of Object.keys(y.durumlar)) expect(ids.has(o)).toBe(true);
    }
  });
  it("finans kapalı: taksit, paket fiyatı, ödeme bildirimi gitmez", () => {
    const g = { id: "g1", zaman: "x", olay: "taksitHatirlatma" as const, veliId: VELI, alici: "a", ogrenciId: null, subeId: "s1", kanal: "sms" as const, metin: "GIZLI-BORC", durum: "iletildi" as const, maliyet: 0 };
    const y = veliVerisi({ ...db, gonderimler: [g], moduller: { ...db.moduller, finans: false } }, VELI);
    expect(y.taksitler).toEqual([]);
    expect(y.gonderimler).toEqual([]);
    for (const p of y.paketler) expect(p.fiyat).toBe(0);
  });
  it("ödev ve etüt modülü kapalı: boş", () => {
    const y = veliVerisi({ ...db, moduller: { ...db.moduller, odev: false, etut: false } }, VELI);
    expect(y.odevler).toEqual([]);
    expect(y.randevular).toEqual([]);
    expect(y.musaitlikler).toEqual([]);
  });
  it("duyuruda gönderen ve diğer alıcılar gitmez", () => {
    const y = veliVerisi({ ...db, duyurular: [{ id: "d", baslik: "b", metin: "m", hedef: { tur: "sube", deger: "s1" }, kanal: "push", zaman: "x", zamanlanmis: false, gonderen: "Gizli Mudur", aliciVeliIds: [VELI, "v9"], okuyanVeliIds: ["v9"] }] }, VELI);
    expect(y.duyurular[0]).toMatchObject({ gonderen: "", aliciVeliIds: [VELI], okuyanVeliIds: [] });
  });
});

describe("API", () => {
  const sms = new KonsolSms();
  let app: Awaited<ReturnType<typeof uygulamaOlustur>>;
  let baglanti: Awaited<ReturnType<typeof baglan>>;
  let ipNo = 1;
  /** Her oturum kendi IP'siyle: IP sınırı ayrı testte denenir */
  const istemci = (ip = `10.0.0.${ipNo++}`) => {
    let cerez = "";
    return async (yol: string, govde?: unknown) => {
      const r = await app.app.request(yol, { method: govde === undefined ? "GET" : "POST", headers: { cookie: cerez, "content-type": "application/json", "x-forwarded-for": ip }, body: govde === undefined ? undefined : JSON.stringify(govde) });
      const c = r.headers.get("set-cookie");
      if (c) cerez = c.split(";")[0];
      return { durum: r.status, veri: (await r.json()) as Record<string, unknown>, cerez: c, onbellek: r.headers.get("cache-control") };
    };
  };
  type Veli = Db["veliler"][number];
  const veliler = (): Veli[] => app.durum.db.veliler.filter((x) => app.durum.db.ogrenciler.some((o) => o.veliIds.includes(x.id) && o.durum === "aktif" && app.durum.db.kayitlar.some((k) => k.ogrenciId === o.id && k.durum === "aktif")));
  let sira = 0;
  /** Sınırlar test arasında karışmasın diye her test farklı veli */
  const yeniVeli = () => veliler()[sira++];
  const girisYap = async (v: Veli) => {
    const i = istemci();
    const k = await i("/api/veli/kod", { telefon: v.telefon });
    const g = await i("/api/veli/giris", { telefon: v.telefon, kod: k.veri.demoKod });
    expect(g.durum).toBe(200);
    return { i, g };
  };
  const sayi = async (veliId: string) => (await baglanti.q("select count(*)::int as n from push_abonelik where veli_id = $1", [veliId]))[0].n as number;
  const abone = (u: string) => ({ endpoint: `https://fcm.googleapis.com/fcm/send/${u}`, keys: { p256dh: "k", auth: "a" } });
  const veliDegistir = (id: string, p: Partial<Veli>) => { app.durum.db.veliler = app.durum.db.veliler.map((v) => (v.id === id ? { ...v, ...p } : v)); };

  beforeAll(async () => {
    baglanti = await baglan();
    app = await uygulamaOlustur({ vt: baglanti, sms, push: null, demo: true, uretim: false });
  }, 120_000);
  afterAll(async () => {
    await new Promise((r) => setTimeout(r, 50)); // arka plandaki kod gönderim kaydı bitsin
    await (baglanti as unknown as { kapat?: () => Promise<void> }).kapat?.();
  });

  describe("giriş", () => {
    const KAYITSIZ = "0599 000 00 01";
    it("kayıtlı ve kayıtsız numara aynı yanıt ve aynı hata akışı", async () => {
      const v = yeniVeli();
      const i = istemci();
      const a = await i("/api/veli/kod", { telefon: v.telefon });
      const b = await i("/api/veli/kod", { telefon: KAYITSIZ });
      expect(a.durum).toBe(b.durum);
      const yanlis = String(((Number(a.veri.demoKod) + 1) % 1_000_000)).padStart(6, "0");
      const ga = await i("/api/veli/giris", { telefon: v.telefon, kod: yanlis });
      const gb = await i("/api/veli/giris", { telefon: KAYITSIZ, kod: "000000" === yanlis ? "000001" : yanlis });
      expect(gb.durum).toBe(ga.durum);
      expect(gb.veri).toEqual(ga.veri);
    });
    it("çeşitli yazımlar aynı numaraya normalize edilir; geçersiz numara reddedilir", async () => {
      const v = yeniVeli();
      const i = istemci();
      const k = await i("/api/veli/kod", { telefon: "+90" + v.telefon.replace(/\D/g, "").slice(1) });
      expect(k.veri.demoKod).toMatch(/^\d{6}$/);
      expect((await i("/api/veli/kod", { telefon: "123" })).durum).toBe(400);
    });
    it("kod tek kullanımlık", async () => {
      const v = yeniVeli();
      const i = istemci();
      const k = await i("/api/veli/kod", { telefon: v.telefon });
      expect((await i("/api/veli/giris", { telefon: v.telefon, kod: k.veri.demoKod })).durum).toBe(200);
      expect((await i("/api/veli/giris", { telefon: v.telefon, kod: k.veri.demoKod })).durum).toBe(401);
    });
    it("5 hatalı denemeden sonra doğru kod da geçmez", async () => {
      const v = yeniVeli();
      const i = istemci();
      const k = await i("/api/veli/kod", { telefon: v.telefon });
      const yanlis = String(((Number(k.veri.demoKod) + 1) % 1_000_000)).padStart(6, "0");
      for (let n = 0; n < 5; n++) await i("/api/veli/giris", { telefon: v.telefon, kod: yanlis });
      const son = await i("/api/veli/giris", { telefon: v.telefon, kod: k.veri.demoKod });
      expect(son.durum).toBe(401);
      expect(son.veri.hata).toMatch(/Yeni kod/);
    });
    it("aynı numaraya 10 dakikada en çok 3 kod", async () => {
      const v = yeniVeli();
      for (let n = 0; n < 3; n++) expect((await istemci()("/api/veli/kod", { telefon: v.telefon })).durum).toBe(200);
      expect((await istemci()("/api/veli/kod", { telefon: v.telefon })).durum).toBe(429);
    });
    it("IP sınırı numaranın hakkını tüketmez", async () => {
      const i = istemci("10.9.9.9");
      for (let n = 0; n < 20; n++) await i("/api/veli/kod", { telefon: `0598 000 00 ${String(n).padStart(2, "0")}` });
      const v = yeniVeli();
      expect((await i("/api/veli/kod", { telefon: v.telefon })).durum).toBe(429);
      expect((await istemci()("/api/veli/kod", { telefon: v.telefon })).durum).toBe(200);
      expect((await istemci()("/api/veli/kod", { telefon: v.telefon })).durum).toBe(200);
      expect((await istemci()("/api/veli/kod", { telefon: v.telefon })).durum).toBe(200);
    });
    it("girişte IP başına deneme sınırı", async () => {
      const i = istemci("10.8.8.8");
      let son = 0;
      for (let n = 0; n < 31; n++) son = (await i("/api/veli/giris", { telefon: KAYITSIZ, kod: "111111" })).durum;
      expect(son).toBe(429);
    });
    it("demo olmayan modda kod yanıta girmez", async () => {
      const ikinci = await uygulamaOlustur({ vt: baglanti, sms, push: null, demo: false, uretim: true });
      const v = yeniVeli();
      const r = await ikinci.app.request("/api/veli/kod", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "10.7.7.7" }, body: JSON.stringify({ telefon: v.telefon }) });
      expect(await r.json()).toEqual({ tamam: true });
    }, 60_000);
    it("öğrencisi kalmayan veliye kod ve oturum yok", async () => {
      const v = yeniVeli();
      const { i } = await girisYap(v);
      const eski = app.durum.db.ogrenciler;
      app.durum.db.ogrenciler = eski.map((o) => (o.veliIds.includes(v.id) ? { ...o, durum: "ayrildi" as const } : o));
      expect((await i("/api/veli/veri")).durum).toBe(401);
      expect((await istemci()("/api/veli/kod", { telefon: v.telefon })).veri.demoKod).toBeUndefined();
      app.durum.db.ogrenciler = eski;
    });
    it("çerez bayrakları ve önbellek", async () => {
      const { i, g } = await girisYap(yeniVeli());
      expect(g.cerez).toMatch(/HttpOnly/i);
      expect(g.cerez).toMatch(/SameSite=Strict/i);
      expect(g.cerez).toMatch(/Max-Age=/i);
      expect((await i("/api/veli/veri")).onbellek).toBe("no-store");
    });
  });

  describe("çıkış ve push", () => {
    it("yalnızca bu cihazın aboneliği silinir, diğer cihaz kalır", async () => {
      const v = yeniVeli();
      const { i } = await girisYap(v);
      await i("/api/veli/push/abone", { abonelik: abone("c1") });
      await i("/api/veli/push/abone", { abonelik: abone("c2") });
      expect(await sayi(v.id)).toBe(2);
      expect((await i("/api/veli/cikis", { endpoint: abone("c1").endpoint })).durum).toBe(200);
      expect(await sayi(v.id)).toBe(1);
      expect(app.durum.db.veliler.find((x) => x.id === v.id)!.pushAcik).toBe(true);
      expect((await i("/api/veli/veri")).durum).toBe(401);
    });
    it("son cihaz çıkınca bildirim kapalıya döner", async () => {
      const v = yeniVeli();
      const { i } = await girisYap(v);
      await i("/api/veli/push/abone", { abonelik: abone("t1") });
      await i("/api/veli/cikis", { endpoint: abone("t1").endpoint });
      expect(await sayi(v.id)).toBe(0);
      expect(app.durum.db.veliler.find((x) => x.id === v.id)!.pushAcik).toBe(false);
    });
    it("başka velinin aboneliği çıkışla silinemez", async () => {
      const a = yeniVeli();
      const b = yeniVeli();
      const ia = (await girisYap(a)).i;
      const ib = (await girisYap(b)).i;
      await ia("/api/veli/push/abone", { abonelik: abone("a1") });
      await ib("/api/veli/cikis", { endpoint: abone("a1").endpoint });
      expect(await sayi(a.id)).toBe(1);
    });
    it("endpoint'siz çıkış bildirim tercihini değiştirmez", async () => {
      const v = yeniVeli();
      veliDegistir(v.id, { pushAcik: true });
      const { i } = await girisYap(v);
      expect((await i("/api/veli/cikis", {})).durum).toBe(200);
      expect(app.durum.db.veliler.find((x) => x.id === v.id)!.pushAcik).toBe(true);
    });
    it("cihaz aboneliği olmadan bildirim açılamaz", async () => {
      const v = yeniVeli();
      veliDegistir(v.id, { pushAcik: false });
      const { i } = await girisYap(v);
      expect((await i("/api/veli/tercih", { pushAcik: true })).durum).toBe(409);
      await i("/api/veli/push/abone", { abonelik: abone("p1") });
      expect((await i("/api/veli/tercih", { pushAcik: true })).durum).toBe(200);
    });
  });

  describe("yazma uçları", () => {
    it("başka velinin çocuğuna izin yazılamaz", async () => {
      const a = yeniVeli();
      const { i } = await girisYap(a);
      const baska = app.durum.db.ogrenciler.find((o) => o.durum === "aktif" && !o.veliIds.includes(a.id))!;
      expect((await i("/api/veli/izin", { ogrenciId: baska.id, tarih: "2030-01-01" })).durum).toBe(403);
    });
    it("geçersiz tarihli izin reddedilir", async () => {
      const a = yeniVeli();
      const { i } = await girisYap(a);
      const c = app.durum.db.ogrenciler.find((o) => o.durum === "aktif" && o.veliIds.includes(a.id))!;
      expect((await i("/api/veli/izin", { ogrenciId: c.id, tarih: "bozuk" })).durum).toBe(400);
    });
    it("tercih yalnızca izinli alanları yazar", async () => {
      const v = yeniVeli();
      const { i } = await girisYap(v);
      await i("/api/veli/tercih", { izinTanitim: true, telefon: "0500 000 00 00", ad: "X" });
      const y = app.durum.db.veliler.find((x) => x.id === v.id)!;
      expect(y.telefon).toBe(v.telefon);
      expect(y.ad).toBe(v.ad);
    });
    it("veli yazma ucu dakikada sınırlıdır", async () => {
      const { i } = await girisYap(yeniVeli());
      let son = 0;
      for (let n = 0; n < 121; n++) son = (await i("/api/veli/okundu", { duyuruIds: [] })).durum;
      expect(son).toBe(429);
      expect((await i("/api/veli/cikis", {})).durum).toBe(200);
    }, 60_000);
    it("personel çerezi olmadan yönetim verisi alınamaz", async () => {
      const { i } = await girisYap(yeniVeli());
      expect((await i("/api/veri")).durum).toBe(401);
    });
  });
});
