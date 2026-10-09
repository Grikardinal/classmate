/**
 * Classmate API (Hono). index.ts sunucuyu başlatır; testler uygulamayı doğrudan çağırır.
 */
import { randomBytes } from "node:crypto";
import { Hono, type Context } from "hono";
import { createMiddleware } from "hono/factory";
import { bodyLimit } from "hono/body-limit";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { secureHeaders } from "hono/secure-headers";
import {
  BUGUN,
  SIMDI,
  SURUM,
  aktifKayit,
  islemYaz,
  ornekVeriUret,
  simdiZaman,
  tamAd,
  tanimKaynagi,
  varsayilanAyarlar,
  varsayilanModuller,
  varsayilanOlaylar,
  varsayilanRolYetkileri,
  yeniId,
  type Db,
  type Gonderim,
  type Kullanici,
  type Veli,
} from "../src/data/model";
import { farkBos, farkHesapla, farkUygula, type Degisiklik } from "../src/data/fark";
import { dakika, haftaGunu, telefonNormalize, tarihEkle } from "../src/lib/kurallar";
import * as m from "../src/data/mock";
import {
  denemeHakki,
  denemeSifirla,
  kodDogrula,
  kodUret,
  oturumAc,
  oturumBul,
  oturumKapat,
  parolaDogru,
  parolaGucluMu,
  parolaOzeti,
  rastgeleParola,
  tumOturumlariKapat,
} from "./kimlik";
import { YetkiHatasi, kapsam, okumaSuz, subeSutunu, veliVerisi, yazmaDenetle, type Aktor } from "./politika";
import { kuyruguIsle, type PushAboneligi, type PushGonderici, type SmsSaglayici } from "./gonderim";
import { otomasyonlariCalistir } from "./zamanlayici";
import { hepsiniYukle, semaKur, tamamenYaz, yaz, type Veritabani } from "./veritabani";
import { yedekAl, yedekOku, yedekleriListele } from "./yedek";

export const DEMO_PAROLA = "Classmate2026";
const PERSONEL_CEREZ = "cm_p";
const VELI_CEREZ = "cm_v";
const PERSONEL_SAAT = 8;

export type Secenekler = { vt: Veritabani; sms: SmsSaglayici; push: PushGonderici | null; demo: boolean; uretim: boolean };

/** Demo değilse: boş kurum + ortam değişkenlerinden ilk genel yönetici */
function bosKurulum(): Db {
  const d = ornekVeriUret();
  const eposta = process.env.ILK_YONETICI_EPOSTA ?? "yonetim@kurum.com";
  const yonetici = { ...d.personel[0], id: "p0", ad: process.env.ILK_YONETICI_AD ?? "Kurum", soyad: "Yöneticisi", eposta, telefon: process.env.ILK_YONETICI_TELEFON ?? "", subeIds: ["s1"], anaSubeId: "s1" };
  return {
    ...d,
    kurum: { ...m.kurum, ad: process.env.KURUM_ADI ?? "Kurumunuz" },
    moduller: { ...varsayilanModuller },
    subeler: [{ id: "s1", ad: "Merkez", kod: "MRK", adres: "", telefon: "", mudur: "", aktif: true }],
    sezonlar: d.sezonlar,
    derslikler: [],
    dersSaatleri: [],
    gruplar: [],
    personel: [yonetici],
    kullanicilar: [{ id: "u0", personelId: "p0", rol: "genel-yonetici", subeIds: "all", eposta, aktif: true, sonGiris: null, ikiAdim: false }],
    girisler: [], veliler: [], ogrenciler: [], kayitlar: [], program: [], tatiller: [], iptaller: [], yoklamalar: {}, izinler: [], adaylar: [],
    odevler: [], musaitlikler: [], randevular: [], paketler: [], gonderimler: [], duyurular: [], taksitler: [], tahsilatlar: [], giderler: [],
    virmanlar: [], islemler: [], iceAktarmalar: [], kvkk: [], avanslar: [], hakedisDurum: {}, otomasyon: {},
    olaylar: varsayilanOlaylar.map((o) => ({ ...o })),
    rolYetkileri: JSON.parse(JSON.stringify(varsayilanRolYetkileri)),
    ayarlar: { ...varsayilanAyarlar },
  };
}

export async function uygulamaOlustur(s: Secenekler) {
  const { vt, sms, push, demo, uretim } = s;
  await semaKur(vt);

  let db = await hepsiniYukle(vt);
  if (!db) {
    db = demo ? ornekVeriUret() : bosKurulum();
    await tamamenYaz(vt, db, (k, x) => subeSutunu(db!, k, x));
    const parola = demo ? DEMO_PAROLA : process.env.ILK_YONETICI_PAROLA;
    if (!parola) throw new Error("Demo dışı ilk kurulum için ILK_YONETICI_PAROLA gerekli");
    const ozet = await parolaOzeti(parola);
    for (const k of db.kullanicilar) await vt.q("insert into parola (kullanici_id, ozet, degistirmeli) values ($1, $2, $3)", [k.id, ozet, !demo]);
  }
  const durum = { db };
  tanimKaynagi(durum.db);

  // Onarım/geçiş: yeni sürümde eklenen veya eksik bildirim olaylarını tamamla
  const eksikOlaylar = varsayilanOlaylar.filter((o) => !durum.db.olaylar.some((x) => x.key === o.key));
  if (eksikOlaylar.length) {
    const fark: Degisiklik = { koleksiyonlar: { olaylar: { yaz: eksikOlaylar.map((o) => ({ ...o })), sil: [] } }, tekil: {} };
    if (durum.db.olaylar.some((o) => !o.key)) fark.koleksiyonlar.olaylar!.sil.push("undefined");
    const sonraki = farkUygula(durum.db, fark);
    await yaz(vt, fark, (k, x) => subeSutunu(sonraki, k, x));
    durum.db = { ...sonraki, olaylar: sonraki.olaylar.filter((o) => o.key) };
  }

  /* ---------- Yazmalar sıralı ---------- */
  let kilit: Promise<unknown> = Promise.resolve();
  const sirali = <T,>(fn: () => Promise<T>): Promise<T> => {
    const p = kilit.then(fn);
    kilit = p.catch(() => undefined);
    return p;
  };
  async function kaydet(fark: Degisiklik) {
    if (farkBos(fark)) return;
    const sonraki = farkUygula(durum.db, fark);
    await yaz(vt, fark, (k, x) => subeSutunu(sonraki, k, x));
    durum.db = sonraki;
    tanimKaynagi(durum.db);
  }
  const sunucuDegisikligi = (fn: (x: Db) => void) =>
    sirali(async () => {
      const x = { ...durum.db } as Db;
      for (const k of Object.keys(x) as (keyof Db)[]) {
        const v = x[k];
        if (Array.isArray(v)) (x as Record<string, unknown>)[k] = [...v];
        else if (v && typeof v === "object") (x as Record<string, unknown>)[k] = { ...(v as object) };
      }
      fn(x);
      await kaydet(farkHesapla(durum.db, x));
    });

  /* ---------- Gönderim kuyruğu ve otomasyonlar ---------- */
  let kuyrukCalisiyor = false;
  async function kuyrukCalistir() {
    if (kuyrukCalisiyor || !durum.db.gonderimler.some((g) => g.durum === "bekliyor")) return;
    kuyrukCalisiyor = true;
    try {
      const degisen = await kuyruguIsle({
        db: durum.db,
        sms,
        push,
        abonelikler: async (veliId) =>
          (await vt.q("select endpoint, abonelik from push_abonelik where veli_id = $1", [veliId])).map((r) => ({ endpoint: String(r.endpoint), abonelik: r.abonelik as PushAboneligi })),
        abonelikSil: async (endpoint) => void (await vt.q("delete from push_abonelik where endpoint = $1", [endpoint])),
      });
      if (degisen.length) await sirali(() => kaydet({ koleksiyonlar: { gonderimler: { yaz: degisen, sil: [] } }, tekil: {} }));
    } finally {
      kuyrukCalisiyor = false;
    }
  }
  async function otomasyonCalistir() {
    await sirali(async () => {
      const taslak = otomasyonlariCalistir(durum.db);
      await kaydet(farkHesapla(durum.db, taslak));
    });
    await kuyrukCalistir();
  }

  /* ---------- Yardımcılar ---------- */
  const cocuklari = (veliId: string) => durum.db.ogrenciler.filter((o) => o.veliIds.includes(veliId) && o.durum === "aktif");
  const ip = (c: Context) => c.req.header("x-forwarded-for")?.split(",")[0].trim() || "yerel";
  const cihaz = (c: Context) => {
    const ua = c.req.header("user-agent") ?? "";
    const tarayici = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "Tarayıcı";
    const sistem = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "Mac" : "Diğer";
    return `${tarayici} · ${sistem}`;
  };
  const cerez = (c: Context, ad: string, deger: string, saat: number) =>
    setCookie(c, ad, deger, { httpOnly: true, sameSite: "Strict", secure: uretim, path: "/", maxAge: saat * 3600 });
  const hata = (c: Context, mesaj: string, kod: 400 | 401 | 403 | 404 | 409 | 429 = 400) => c.json({ hata: mesaj }, kod);

  function aktorBul(kullaniciId: string): Aktor | null {
    const k = durum.db.kullanicilar.find((x) => x.id === kullaniciId && x.aktif);
    const p = k && durum.db.personel.find((x) => x.id === k.personelId);
    return k && p ? { kullanici: k, personel: p } : null;
  }
  const benBilgisi = async (a: Aktor) => {
    const r = await vt.q("select degistirmeli from parola where kullanici_id = $1", [a.kullanici.id]);
    return { tur: "personel" as const, kullanici: a.kullanici, personel: a.personel, kapsam: kapsam(durum.db, a.kullanici), parolaDegistirmeli: !!r[0]?.degistirmeli };
  };
  async function girisKaydet(k: Kullanici, c: Context, basarili: boolean) {
    await sunucuDegisikligi((x) => {
      x.girisler = [{ id: yeniId("gl"), kullaniciId: k.id, tarih: simdiZaman(), cihaz: cihaz(c), basarili }, ...x.girisler].slice(0, 500);
      if (basarili) x.kullanicilar = x.kullanicilar.map((u) => (u.id === k.id ? { ...u, sonGiris: simdiZaman() } : u));
    });
  }
  /** Giriş kodu SMS'i: kod kayda yazılmaz, yalnızca maliyet takibi için iz bırakılır */
  async function kodGonder(telefon: string, kod: string, veliId: string | null, subeId: string) {
    const metin = `${durum.db.kurum.ad} giriş kodunuz: ${kod}. Kimseyle paylaşmayın.`;
    const r = await sms.gonder(telefon, metin);
    await sunucuDegisikligi((x) => {
      const iz: Gonderim = {
        id: yeniId("gn"), zaman: simdiZaman(), olay: "otp", veliId, alici: telefon, ogrenciId: null, subeId, kanal: "sms",
        metin: "Giriş kodu gönderildi.", durum: r.tamam ? "iletildi" : "basarisiz", maliyet: r.tamam ? x.ayarlar.smsBirimFiyat : 0, hata: r.tamam ? undefined : r.hata,
      };
      x.gonderimler.push(iz);
    });
    return r;
  }

  /* =========================== Uygulama =========================== */
  const app = new Hono<{ Variables: { aktor: Aktor; veli: Veli } }>();
  app.use("*", secureHeaders({ crossOriginEmbedderPolicy: false }));
  app.use("/api/*", bodyLimit({ maxSize: 8 * 1024 * 1024, onError: (c) => c.json({ hata: "İstek çok büyük" }, 413) }));
  // Çapraz site isteklerine karşı: yazma isteklerinde JSON zorunlu (SameSite=Strict çerezle birlikte)
  app.use("/api/*", async (c, next) => {
    if (c.req.method !== "GET" && c.req.method !== "DELETE" && !(c.req.header("content-type") ?? "").includes("application/json")) return hata(c, "JSON bekleniyor", 400);
    await next();
  });
  app.onError((e, c) => {
    if (e instanceof YetkiHatasi) return hata(c, e.message, 403);
    console.error(e);
    return hata(c, "Sunucu hatası", 400);
  });

  app.get("/api/durum", (c) =>
    c.json({
      surum: SURUM,
      demo,
      vt: vt.tur,
      sms: sms.ad,
      push: !!push,
      kurum: durum.db.kurum.ad,
      bugun: BUGUN,
      saat: SIMDI,
      demoHesaplar: demo
        ? durum.db.kullanicilar
            .filter((k) => k.aktif && ["u0", "u1", "u2", "u9", "u5"].includes(k.id))
            .map((k) => ({ eposta: k.eposta, ad: tamAd(durum.db.personel.find((p) => p.id === k.personelId)), rol: k.rol }))
        : undefined,
      demoParola: demo ? DEMO_PAROLA : undefined,
      demoVeliler: demo
        ? [
            durum.db.veliler.find((v) => cocuklari(v.id).length > 1),
            durum.db.veliler.find((v) => cocuklari(v.id).length === 1 && v.pushAcik),
            durum.db.veliler.find((v) => cocuklari(v.id).length === 1 && !v.pushAcik),
          ]
            .filter((v): v is Veli => !!v)
            .map((v) => ({ ad: tamAd(v), telefon: v.telefon, cocuklar: cocuklari(v.id).map((o) => o.ad).join(", ") }))
        : undefined,
    }),
  );

  /* ---------- Personel girişi ---------- */
  app.post("/api/giris", async (c) => {
    const { eposta, parola } = await c.req.json<{ eposta: string; parola: string }>();
    const e = String(eposta ?? "").trim().toLocaleLowerCase("tr-TR");
    if (!denemeHakki(`giris:${e}:${ip(c)}`, 5, 15 * 60_000)) return hata(c, "Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.", 429);
    const k = durum.db.kullanicilar.find((x) => x.eposta.toLocaleLowerCase("tr-TR") === e);
    const kayit = k ? (await vt.q("select ozet from parola where kullanici_id = $1", [k.id]))[0] : undefined;
    const dogru = !!kayit && (await parolaDogru(String(parola ?? ""), String(kayit.ozet)));
    if (!k || !dogru || !k.aktif) {
      if (k) await girisKaydet(k, c, false);
      return hata(c, k && dogru && !k.aktif ? "Hesabınız pasif. Yöneticinizle görüşün." : "E-posta veya parola hatalı.", 401);
    }
    denemeSifirla(`giris:${e}:${ip(c)}`);
    if (k.ikiAdim) {
      const p = durum.db.personel.find((x) => x.id === k.personelId)!;
      const tel = telefonNormalize(p.telefon);
      if (!tel) return hata(c, "İki adımlı doğrulama için kayıtlı cep telefonu yok. Yöneticinizle görüşün.", 400);
      const gecici = randomBytes(18).toString("base64url");
      const kod = kodUret(`2fa:${gecici}`, k.id);
      await kodGonder(tel, kod, null, p.anaSubeId);
      return c.json({ ikiAdim: true, gecici, telefon: tel.slice(0, 4) + " *** ** " + tel.slice(-2), demoKod: demo && sms.ad === "konsol" ? kod : undefined });
    }
    cerez(c, PERSONEL_CEREZ, await oturumAc(vt, "personel", k.id, PERSONEL_SAAT, cihaz(c)), PERSONEL_SAAT);
    await girisKaydet(k, c, true);
    return c.json(await benBilgisi(aktorBul(k.id)!));
  });

  app.post("/api/giris/dogrula", async (c) => {
    const { gecici, kod } = await c.req.json<{ gecici: string; kod: string }>();
    const r = kodDogrula(`2fa:${gecici}`, String(kod ?? ""));
    if (!r.tamam) return hata(c, r.neden === "deneme" ? "Çok fazla hatalı kod. Yeniden giriş yapın." : r.neden === "sure" ? "Kodun süresi doldu." : "Kod hatalı.", 401);
    const a = aktorBul(r.veri);
    if (!a) return hata(c, "Hesap bulunamadı.", 401);
    cerez(c, PERSONEL_CEREZ, await oturumAc(vt, "personel", a.kullanici.id, PERSONEL_SAAT, cihaz(c)), PERSONEL_SAAT);
    await girisKaydet(a.kullanici, c, true);
    return c.json(await benBilgisi(a));
  });

  app.post("/api/cikis", async (c) => {
    await oturumKapat(vt, getCookie(c, PERSONEL_CEREZ));
    deleteCookie(c, PERSONEL_CEREZ, { path: "/" });
    return c.json({ tamam: true });
  });

  /* ---------- Personel oturumu gerektiren uçlar ---------- */
  const personelGerekli = createMiddleware<{ Variables: { aktor: Aktor; veli: Veli } }>(async (c, next) => {
    const o = await oturumBul(vt, getCookie(c, PERSONEL_CEREZ), "personel");
    const a = o && aktorBul(o.sahipId);
    if (!a) return hata(c, "Oturum açmanız gerekiyor.", 401);
    c.set("aktor", a);
    await next();
  });

  app.get("/api/ben", personelGerekli, async (c) => c.json(await benBilgisi(c.get("aktor"))));
  app.get("/api/veri", personelGerekli, (c) => c.json(okumaSuz(durum.db, c.get("aktor"))));

  app.post("/api/degisiklik", personelGerekli, async (c) => {
    const ham = await c.req.json<Degisiklik>();
    if (!ham || typeof ham !== "object" || typeof ham.koleksiyonlar !== "object" || typeof ham.tekil !== "object") return hata(c, "Geçersiz değişiklik paketi");
    const a = c.get("aktor");
    await sirali(async () => {
      const temiz = yazmaDenetle(durum.db, farkUygula(durum.db, ham), ham, a, simdiZaman());
      // Gönderim alıcısını sunucudaki tam veriden yaz (öğretmen maskeli telefon görür)
      for (const g of (temiz.koleksiyonlar.gonderimler?.yaz ?? []) as Gonderim[]) {
        const v = durum.db.veliler.find((x) => x.id === g.veliId);
        if (v) g.alici = `${tamAd(v)} · ${v.telefon}`;
      }
      await kaydet(temiz);
      // Pasife alınan kullanıcıların oturumlarını kapat
      for (const k of (temiz.koleksiyonlar.kullanicilar?.yaz ?? []) as Kullanici[]) if (!k.aktif) await tumOturumlariKapat(vt, "personel", k.id);
    });
    void kuyrukCalistir();
    return c.json({ tamam: true });
  });

  app.post("/api/parola", personelGerekli, async (c) => {
    const { eski, yeni } = await c.req.json<{ eski: string; yeni: string }>();
    const a = c.get("aktor");
    const kayit = (await vt.q("select ozet from parola where kullanici_id = $1", [a.kullanici.id]))[0];
    if (!kayit || !(await parolaDogru(String(eski ?? ""), String(kayit.ozet)))) return hata(c, "Mevcut parola hatalı.", 403);
    if (!parolaGucluMu(String(yeni ?? ""))) return hata(c, "Yeni parola en az 8 karakter olmalı, harf ve rakam içermeli.");
    await vt.q("update parola set ozet = $2, degistirmeli = false where kullanici_id = $1", [a.kullanici.id, await parolaOzeti(yeni)]);
    await sunucuDegisikligi((x) => islemYaz(x, tamAd(a.personel), "Parola", "Parola değiştirildi"));
    return c.json({ tamam: true });
  });

  app.post("/api/kullanicilar/:id/parola-sifirla", personelGerekli, async (c) => {
    const a = c.get("aktor");
    const hedef = durum.db.kullanicilar.find((k) => k.id === c.req.param("id"));
    const yetkili = a.kullanici.rol === "genel-yonetici" || durum.db.rolYetkileri[a.kullanici.rol]?.["02"];
    if (!hedef || !yetkili) return hata(c, "Bu işlem için yetkiniz yok.", 403);
    if (a.kullanici.rol !== "genel-yonetici" && hedef.subeIds === "all") return hata(c, "Bu kullanıcının parolasını sıfırlayamazsınız.", 403);
    const parola = rastgeleParola();
    await vt.q(
      "insert into parola (kullanici_id, ozet, degistirmeli) values ($1, $2, true) on conflict (kullanici_id) do update set ozet = excluded.ozet, degistirmeli = true",
      [hedef.id, await parolaOzeti(parola)],
    );
    await tumOturumlariKapat(vt, "personel", hedef.id);
    const ad = tamAd(durum.db.personel.find((p) => p.id === hedef.personelId));
    await sunucuDegisikligi((x) => islemYaz(x, tamAd(a.personel), "Parola sıfırlama", `${ad} için geçici parola üretildi`));
    return c.json({ parola });
  });

  app.get("/api/yedek", personelGerekli, (c) => {
    if (c.get("aktor").kullanici.rol !== "genel-yonetici") return hata(c, "Yalnızca genel yönetici yedek alabilir.", 403);
    return c.json(durum.db);
  });
  app.post("/api/yedek", personelGerekli, async (c) => {
    const a = c.get("aktor");
    if (a.kullanici.rol !== "genel-yonetici") return hata(c, "Yalnızca genel yönetici geri yükleyebilir.", 403);
    const yeni = await c.req.json<Db>();
    if (yeni?.surum !== SURUM || !Array.isArray(yeni.ogrenciler) || !Array.isArray(yeni.kullanicilar)) return hata(c, "Geçerli bir Classmate yedeği değil (veya farklı sürüm).");
    if (!yeni.kullanicilar.some((k) => k.id === a.kullanici.id && k.aktif)) return hata(c, "Yedekte sizin hesabınız yok; geri yükleme sizi dışarıda bırakırdı.");
    await sirali(async () => {
      await tamamenYaz(vt, yeni, (k, x) => subeSutunu(yeni, k, x));
      durum.db = (await hepsiniYukle(vt))!;
      tanimKaynagi(durum.db);
    });
    await sunucuDegisikligi((x) => islemYaz(x, tamAd(a.personel), "Geri yükleme", "Yedekten geri yüklendi"));
    return c.json({ tamam: true });
  });
  app.get("/api/yedek/liste", personelGerekli, async (c) => {
    if (c.get("aktor").kullanici.rol !== "genel-yonetici") return hata(c, "Yalnızca genel yönetici.", 403);
    return c.json({ yedekler: await yedekleriListele(), vt: vt.tur });
  });
  app.post("/api/yedek/al", personelGerekli, async (c) => {
    const a = c.get("aktor");
    if (a.kullanici.rol !== "genel-yonetici") return hata(c, "Yalnızca genel yönetici.", 403);
    const ad = await yedekAl(durum.db);
    await sunucuDegisikligi((x) => islemYaz(x, tamAd(a.personel), "Yedek", `Elle yedek alındı: ${ad}`));
    return c.json({ ad });
  });
  app.get("/api/yedek/dosya/:ad", personelGerekli, async (c) => {
    if (c.get("aktor").kullanici.rol !== "genel-yonetici") return hata(c, "Yalnızca genel yönetici.", 403);
    const icerik = await yedekOku(c.req.param("ad"));
    if (!icerik) return hata(c, "Yedek bulunamadı.", 404);
    return c.body(icerik, 200, { "content-type": "application/json", "content-disposition": `attachment; filename="${c.req.param("ad")}"` });
  });
  app.post("/api/demo/sifirla", personelGerekli, async (c) => {
    if (!demo || c.get("aktor").kullanici.rol !== "genel-yonetici") return hata(c, "Yalnızca demo kurulumunda kullanılabilir.", 403);
    await sirali(async () => {
      const yeni = ornekVeriUret();
      await tamamenYaz(vt, yeni, (k, x) => subeSutunu(yeni, k, x));
      durum.db = (await hepsiniYukle(vt))!;
      tanimKaynagi(durum.db);
    });
    return c.json({ tamam: true });
  });

  /* ---------- Veli portalı ---------- */
  const veliBul = (veliId: string) => {
    const v = durum.db.veliler.find((x) => x.id === veliId);
    const cocukVar = v && durum.db.ogrenciler.some((o) => o.veliIds.includes(v.id) && o.durum === "aktif" && aktifKayit(durum.db, o.id));
    return cocukVar ? v : null;
  };

  app.post("/api/veli/kod", async (c) => {
    const { telefon } = await c.req.json<{ telefon: string }>();
    const tel = telefonNormalize(String(telefon ?? ""));
    if (!tel) return hata(c, "Geçerli bir cep telefonu girin.");
    if (!denemeHakki(`kod:${tel}`, 3, 10 * 60_000) || !denemeHakki(`kodip:${ip(c)}`, 20, 10 * 60_000))
      return hata(c, "Çok fazla kod istendi. 10 dakika sonra tekrar deneyin.", 429);
    const v = durum.db.veliler.find((x) => x.telefon === tel && veliBul(x.id));
    // Numaranın kayıtlı olup olmadığı dışarı sızdırılmaz: her durumda aynı yanıt
    if (!v) return c.json({ tamam: true });
    const kod = kodUret(`veli:${tel}`, v.id);
    const subeId = aktifKayit(durum.db, cocuklari(v.id)[0]?.id ?? "")?.subeId ?? "s1";
    await kodGonder(tel, kod, v.id, subeId);
    return c.json({ tamam: true, demoKod: demo && sms.ad === "konsol" ? kod : undefined });
  });

  app.post("/api/veli/giris", async (c) => {
    const { telefon, kod } = await c.req.json<{ telefon: string; kod: string }>();
    const tel = telefonNormalize(String(telefon ?? ""));
    if (!tel) return hata(c, "Geçerli bir cep telefonu girin.");
    const r = kodDogrula(`veli:${tel}`, String(kod ?? ""));
    if (!r.tamam)
      return hata(c, r.neden === "deneme" ? "Çok fazla hatalı deneme. Yeni kod isteyin." : r.neden === "sure" ? "Kodun süresi doldu. Yeni kod isteyin." : r.neden === "yok" ? "Önce kod isteyin." : `Kod hatalı. Kalan deneme: ${r.kalan}`, 401);
    const v = veliBul(r.veri);
    if (!v) return hata(c, "Hesap bulunamadı.", 401);
    const saat = durum.db.ayarlar.oturumGun * 24;
    cerez(c, VELI_CEREZ, await oturumAc(vt, "veli", v.id, saat, cihaz(c)), saat);
    if (v.portalDavet !== "giris-yapti") await sunucuDegisikligi((x) => (x.veliler = x.veliler.map((y) => (y.id === v.id ? { ...y, portalDavet: "giris-yapti" } : y))));
    return c.json({ tamam: true });
  });

  const veliGerekli = createMiddleware<{ Variables: { aktor: Aktor; veli: Veli } }>(async (c, next) => {
    const o = await oturumBul(vt, getCookie(c, VELI_CEREZ), "veli");
    const v = o && veliBul(o.sahipId);
    if (!v) return hata(c, "Oturum açmanız gerekiyor.", 401);
    c.set("veli", v);
    await next();
  });
  app.get("/api/veli/ben", veliGerekli, (c) => c.json({ tur: "veli", veli: c.get("veli") }));
  app.get("/api/veli/veri", veliGerekli, (c) => c.json(veliVerisi(durum.db, c.get("veli").id)));
  app.post("/api/veli/cikis", veliGerekli, async (c) => {
    await oturumKapat(vt, getCookie(c, VELI_CEREZ));
    deleteCookie(c, VELI_CEREZ, { path: "/" });
    return c.json({ tamam: true });
  });

  const cocukMu = (veliId: string, ogrenciId: string) => cocuklari(veliId).some((o) => o.id === ogrenciId);

  app.post("/api/veli/izin", veliGerekli, async (c) => {
    const v = c.get("veli");
    const { ogrenciId, tarih, not } = await c.req.json<{ ogrenciId: string; tarih: string; not: string }>();
    if (!cocukMu(v.id, ogrenciId)) return hata(c, "Bu öğrenci için işlem yapamazsınız.", 403);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(tarih)) || tarih < BUGUN || tarih > tarihEkle(BUGUN, 60)) return hata(c, "Geçersiz tarih.");
    await sunucuDegisikligi((x) => {
      x.izinler.push({ id: yeniId("iz"), ogrenciId, tarih, not: String(not ?? "").slice(0, 300) || "Veli bildirdi", veliId: v.id, olusturma: simdiZaman() });
      islemYaz(x, tamAd(v), "İzin bildirimi", `${tamAd(x.ogrenciler.find((o) => o.id === ogrenciId))} — ${tarih}`, aktifKayit(x, ogrenciId)?.subeId);
    });
    return c.json({ tamam: true });
  });

  app.post("/api/veli/randevu", veliGerekli, async (c) => {
    const v = c.get("veli");
    const { ogrenciId, ogretmenId, tarih, bas } = await c.req.json<{ ogrenciId: string; ogretmenId: string; tarih: string; bas: string }>();
    const d = durum.db;
    if (!d.moduller.etut) return hata(c, "Etüt modülü kapalı.", 403);
    if (!cocukMu(v.id, ogrenciId)) return hata(c, "Bu öğrenci için işlem yapamazsınız.", 403);
    const subeId = aktifKayit(d, ogrenciId)?.subeId;
    const basDk = dakika(String(bas));
    const m = d.musaitlikler.find((x) => x.ogretmenId === ogretmenId && x.subeId === subeId && x.gun === haftaGunu(String(tarih)) && dakika(x.bas) <= basDk && basDk + 40 <= dakika(x.bit));
    if (!m) return hata(c, "Bu saat öğretmenin müsaitlik saatleri içinde değil.");
    if (String(tarih) < BUGUN || (tarih === BUGUN && String(bas) <= SIMDI)) return hata(c, "Geçmiş bir saate randevu alınamaz.");
    const bit = `${String(Math.floor((basDk + 40) / 60)).padStart(2, "0")}:${String((basDk + 40) % 60).padStart(2, "0")}`;
    const dolu = d.randevular.some((r) => r.ogretmenId === ogretmenId && r.tarih === tarih && r.durum !== "iptal" && dakika(r.bas) < basDk + 40 && basDk < dakika(r.bit));
    if (dolu) return hata(c, "Bu saat az önce doldu. Başka bir saat seçin.", 409);
    const ogretmen = d.personel.find((p) => p.id === ogretmenId);
    const paket = d.paketler.find((p) => p.ogrenciId === ogrenciId && p.ogretmenId === ogretmenId && p.kalan > 0);
    await sunucuDegisikligi((x) => {
      x.randevular.push({
        id: yeniId("r"), ogretmenId, subeId: subeId!, tarih, bas, bit, tur: paket ? "ozel" : "bireysel", ogrenciIds: [ogrenciId],
        dersId: ogretmen?.dersIds[0] ?? "l2", durum: "planli", link: "", paketId: paket?.id ?? null, olusturan: "veli",
      });
      islemYaz(x, tamAd(v), "Etüt randevusu (veli)", `${tamAd(x.ogrenciler.find((o) => o.id === ogrenciId))} — ${tarih} ${bas}`, subeId);
    });
    return c.json({ tamam: true });
  });

  app.post("/api/veli/randevu/:id/iptal", veliGerekli, async (c) => {
    const v = c.get("veli");
    const r = durum.db.randevular.find((x) => x.id === c.req.param("id"));
    if (!r || !r.ogrenciIds.some((o) => cocukMu(v.id, o))) return hata(c, "Randevu bulunamadı.", 404);
    if (r.durum !== "planli") return hata(c, "Bu randevu iptal edilemez.");
    const kalanSaat = (new Date(`${r.tarih}T${r.bas}`).getTime() - new Date(`${BUGUN}T${SIMDI}`).getTime()) / 36e5;
    if (kalanSaat < durum.db.ayarlar.etutIptalSaat) return hata(c, `Randevular en geç ${durum.db.ayarlar.etutIptalSaat} saat öncesine kadar iptal edilebilir.`);
    await sunucuDegisikligi((x) => {
      x.randevular = x.randevular.map((y) => (y.id === r.id ? { ...y, durum: "iptal" } : y));
      islemYaz(x, tamAd(v), "Etüt iptali (veli)", `${r.tarih} ${r.bas}`, r.subeId);
    });
    return c.json({ tamam: true });
  });

  app.post("/api/veli/tercih", veliGerekli, async (c) => {
    const v = c.get("veli");
    const b = await c.req.json<Partial<Pick<Veli, "pushAcik" | "izinSms" | "izinTanitim">>>();
    const p: Partial<Veli> = {};
    for (const k of ["pushAcik", "izinSms", "izinTanitim"] as const) if (typeof b[k] === "boolean") p[k] = b[k];
    await sunucuDegisikligi((x) => (x.veliler = x.veliler.map((y) => (y.id === v.id ? { ...y, ...p } : y))));
    return c.json({ tamam: true });
  });

  app.post("/api/veli/okundu", veliGerekli, async (c) => {
    const v = c.get("veli");
    const { duyuruIds } = await c.req.json<{ duyuruIds: string[] }>();
    const ids = new Set((duyuruIds ?? []).map(String));
    await sunucuDegisikligi((x) => {
      x.duyurular = x.duyurular.map((d) => (ids.has(d.id) && d.aliciVeliIds.includes(v.id) && !d.okuyanVeliIds.includes(v.id) ? { ...d, okuyanVeliIds: [...d.okuyanVeliIds, v.id] } : d));
    });
    return c.json({ tamam: true });
  });

  app.post("/api/veli/talep", veliGerekli, async (c) => {
    const v = c.get("veli");
    const { metin } = await c.req.json<{ metin: string }>();
    const t = String(metin ?? "").trim().slice(0, 500);
    if (!t) return hata(c, "Talep boş olamaz.");
    const subeId = aktifKayit(durum.db, cocuklari(v.id)[0]?.id ?? "")?.subeId ?? null;
    await sunucuDegisikligi((x) => islemYaz(x, tamAd(v), "Bilgi güncelleme talebi", t, subeId));
    return c.json({ tamam: true });
  });

  app.post("/api/veli/push/abone", veliGerekli, async (c) => {
    const v = c.get("veli");
    const { abonelik } = await c.req.json<{ abonelik: PushAboneligi }>();
    if (!abonelik?.endpoint || !/^https:\/\//.test(abonelik.endpoint) || !abonelik.keys?.p256dh) return hata(c, "Geçersiz abonelik.");
    await vt.q(
      "insert into push_abonelik (endpoint, veli_id, abonelik) values ($1, $2, $3) on conflict (endpoint) do update set veli_id = excluded.veli_id, abonelik = excluded.abonelik",
      [abonelik.endpoint, v.id, JSON.stringify(abonelik)],
    );
    await sunucuDegisikligi((x) => (x.veliler = x.veliler.map((y) => (y.id === v.id ? { ...y, pushAcik: true } : y))));
    return c.json({ tamam: true });
  });

  app.get("/api/push/anahtar", (c) => (push ? c.json({ anahtar: push.acikAnahtar }) : hata(c, "Web push yapılandırılmamış.", 404)));
  app.all("/api/*", (c) => hata(c, "Bulunamadı", 404));

  /** Gece 03:00'ten sonra günde bir otomatik yedek */
  let sonYedekGunu = "";
  async function gunlukYedek() {
    if (SIMDI < "03:00" || sonYedekGunu === BUGUN) return;
    sonYedekGunu = BUGUN;
    if ((await yedekleriListele()).some((y) => y.ad.includes(BUGUN))) return;
    await yedekAl(durum.db);
  }

  return { app, durum, kuyrukCalistir, otomasyonCalistir, kaydet, gunlukYedek };
}
