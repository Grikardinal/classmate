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
  bildirimEkle,
  islemYaz,
  personelAdi,
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
import { telefonNormalize } from "../src/lib/kurallar";
import * as m from "../src/data/mock";
import { ayniEposta, bolumYetkisi, epostaNormalize, parolaDegisimDogrula, parolaSifirlamaEngeli } from "../src/bolumler/02-kullanicilar/kurallar";
import {
  denemeHakki,
  denemeSifirla,
  digerOturumlariKapat,
  kodDogrula,
  kodUret,
  oturumAc,
  oturumBul,
  oturumKapat,
  parolaDogru,
  parolaOzeti,
  rastgeleParola,
  tumOturumlariKapat,
} from "./kimlik";
import { izinEngeli } from "../src/bolumler/07-yoklama/kurallar";
import { smsIzniUygula } from "../src/bolumler/08-odevler/kurallar";
import { GIRIS_SINIRLARI, YAZMA_SINIRLARI, kodHataMesaji } from "../src/bolumler/11-veli-portali/kurallar";
import { SLOT_DOLU, ogrencileriCikar, veliIptalEngeli, veliRandevuPlani } from "../src/bolumler/09-etut/kurallar";
import { TAKILI_HATA, pushAbonelikTemizle, takiliSatirlar } from "../src/bolumler/10-iletisim/kurallar";
import { YetkiHatasi, kapsam, okumaSuz, subeSutunu, veliVerisi, yazmaDenetle, type Aktor } from "./politika";
import { kuyruguIsle, type PushAboneligi, type PushGonderici, type SmsSaglayici } from "./gonderim";
import { otomasyonlariCalistir } from "./zamanlayici";
import { hepsiniYukle, semaKur, tamamenYaz, veriyiOnar, yaz, type Veritabani } from "./veritabani";
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
    fiyatListesi: [],
    derslikler: [],
    dersSaatleri: [],
    gruplar: [],
    personel: [yonetici],
    kullanicilar: [{ id: "u0", personelId: "p0", rol: "genel-yonetici", subeIds: "all", eposta, aktif: true, sonGiris: null, ikiAdim: false }],
    girisler: [], veliler: [], ogrenciler: [], kayitlar: [], program: [], tatiller: [], iptaller: [], yoklamalar: {}, izinler: [], adaylar: [],
    odevler: [], musaitlikler: [], randevular: [], paketler: [], gonderimler: [], duyurular: [], taksitler: [], tahsilatlar: [], giderler: [],
    virmanlar: [], iadeler: [], islemler: [], iceAktarmalar: [], kvkk: [], avanslar: [], hakedisDurum: {}, otomasyon: {},
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

  // Onarım/geçiş: eski biçimli fiyat listesi yüklenirken çevrildi (veriyiOnar); çevrilmiş hali kalıcı yazılır
  const kayitliFiyat = (await vt.q("select veri from tekil where anahtar = 'fiyatListesi'"))[0]?.veri;
  if (JSON.stringify(kayitliFiyat) !== JSON.stringify(durum.db.fiyatListesi))
    await yaz(vt, { koleksiyonlar: {}, tekil: { fiyatListesi: durum.db.fiyatListesi } }, () => null);

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
      // Tek süreçte aynı anda bir kuyruk çalışır; burada gonderimBasladi işareti taşıyan satır önceki çalışmadan kalmıştır
      const takili = takiliSatirlar(durum.db.gonderimler);
      if (takili.length) await sirali(() => kaydet({ koleksiyonlar: { gonderimler: { yaz: takili.map((g) => ({ ...g, durum: "basarisiz", gonderimBasladi: undefined, hata: TAKILI_HATA })), sil: [] } }, tekil: {} }));
      await kuyruguIsle({
        db: () => durum.db,
        sms,
        push,
        abonelikler: async (veliId) =>
          (await vt.q("select endpoint, abonelik from push_abonelik where veli_id = $1", [veliId])).map((r) => ({ endpoint: String(r.endpoint), abonelik: r.abonelik as PushAboneligi })),
        abonelikSil: async (endpoint) => void (await vt.q("delete from push_abonelik where endpoint = $1", [endpoint])),
        // O anki satırın üstüne yazılır; gönderim sürerken silinen satır geri gelmez
        yamala: (id, yama) =>
          sirali(async () => {
            const g = durum.db.gonderimler.find((x) => x.id === id);
            if (g) await kaydet({ koleksiyonlar: { gonderimler: { yaz: [{ ...g, ...yama }], sil: [] } }, tekil: {} });
          }),
      });
    } catch (e) {
      // İstek sırasında tetiklenir: yakalanmayan hata süreci düşürmesin; bekleyen satırlar sonraki çalışmada işlenir
      console.error("Gönderim kuyruğu hatası:", (e as Error).message);
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

  /** Hesap ve bağlı personel kartı aktifse aktör (her istekte güncel veriden: pasife alınan hesap hemen düşer) */
  function aktorBul(kullaniciId: string): Aktor | null {
    const k = durum.db.kullanicilar.find((x) => x.id === kullaniciId && x.aktif);
    const p = k && durum.db.personel.find((x) => x.id === k.personelId && x.aktif !== false);
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
    const e = epostaNormalize(eposta);
    // IP başına 5 ve (x-forwarded-for değiştirilerek aşılmasın diye) e-posta başına 20 deneme / 15 dk
    if (!denemeHakki(`giris:${e}:${ip(c)}`, 5, 15 * 60_000) || !denemeHakki(`giris:${e}`, 20, 15 * 60_000))
      return hata(c, "Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.", 429);
    const k = durum.db.kullanicilar.find((x) => ayniEposta(x.eposta, e));
    const kayit = k ? (await vt.q("select ozet from parola where kullanici_id = $1", [k.id]))[0] : undefined;
    // Kullanıcı yoksa da özet hesaplanır: yanıt süresinden e-postanın kayıtlı olduğu anlaşılmasın
    const dogru = await parolaDogru(String(parola ?? ""), kayit ? String(kayit.ozet) : null);
    const aktif = !!k && !!aktorBul(k.id);
    if (!k || !dogru || !aktif) {
      if (k) await girisKaydet(k, c, false);
      return hata(c, k && dogru && !aktif ? "Hesabınız pasif. Yöneticinizle görüşün." : "E-posta veya parola hatalı.", 401);
    }
    if (k.ikiAdim) {
      // Sayaç ikinci adım tamamlanınca sıfırlanır (parolayı bilen biri sınırsız kod isteyip deneyemesin)
      if (!denemeHakki(`2fa:${k.id}`, 5, 15 * 60_000)) return hata(c, "Çok fazla doğrulama kodu istendi. 15 dakika sonra tekrar deneyin.", 429);
      const p = durum.db.personel.find((x) => x.id === k.personelId)!;
      const tel = telefonNormalize(p.telefon);
      if (!tel) return hata(c, "İki adımlı doğrulama için kayıtlı cep telefonu yok. Yöneticinizle görüşün.", 400);
      const gecici = randomBytes(18).toString("base64url");
      const kod = kodUret(`2fa:${gecici}`, k.id);
      await kodGonder(tel, kod, null, p.anaSubeId);
      return c.json({ ikiAdim: true, gecici, telefon: tel.slice(0, 4) + " *** ** " + tel.slice(-2), demoKod: demo && sms.ad === "konsol" ? kod : undefined });
    }
    denemeSifirla(`giris:${e}:${ip(c)}`);
    denemeSifirla(`giris:${e}`);
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
    denemeSifirla(`giris:${epostaNormalize(a.kullanici.eposta)}:${ip(c)}`);
    denemeSifirla(`giris:${epostaNormalize(a.kullanici.eposta)}`);
    denemeSifirla(`2fa:${a.kullanici.id}`);
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
    // Açık oturumu ele geçiren biri mevcut parolayı deneme-yanılmayla bulamasın
    if (!denemeHakki(`parola:${a.kullanici.id}`, 5, 15 * 60_000)) return hata(c, "Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.", 429);
    const kayit = (await vt.q("select ozet from parola where kullanici_id = $1", [a.kullanici.id]))[0];
    if (!kayit || !(await parolaDogru(String(eski ?? ""), String(kayit.ozet)))) return hata(c, "Mevcut parola hatalı.", 403);
    const kural = parolaDegisimDogrula(String(eski ?? ""), String(yeni ?? ""));
    if (kural) return hata(c, kural);
    denemeSifirla(`parola:${a.kullanici.id}`);
    await vt.q("update parola set ozet = $2, degistirmeli = false where kullanici_id = $1", [a.kullanici.id, await parolaOzeti(yeni)]);
    // Parola değişince bu oturum dışındaki açık oturumlar kapanır
    await digerOturumlariKapat(vt, "personel", a.kullanici.id, getCookie(c, PERSONEL_CEREZ));
    await sunucuDegisikligi((x) => islemYaz(x, tamAd(a.personel), "Parola", "Parola değiştirildi"));
    return c.json({ tamam: true });
  });

  app.post("/api/kullanicilar/:id/parola-sifirla", personelGerekli, async (c) => {
    const a = c.get("aktor");
    const hedef = durum.db.kullanicilar.find((k) => k.id === c.req.param("id"));
    const yetkili = a.kullanici.rol === "genel-yonetici" || bolumYetkisi(durum.db.rolYetkileri, a.kullanici.rol, "02");
    if (!hedef || !yetkili) return hata(c, "Bu işlem için yetkiniz yok.", 403);
    // Kendinden yetkili hesap, kapsam dışı şube ve kendi hesabı (eski parola sorulmadan) sıfırlanamaz
    const engel = parolaSifirlamaEngeli(a.kullanici, hedef, kapsam(durum.db, a.kullanici));
    if (engel) return hata(c, engel, 403);
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
    const ham = await c.req.json<Db>();
    if (ham?.surum !== SURUM || !Array.isArray(ham.ogrenciler) || !Array.isArray(ham.kullanicilar)) return hata(c, "Geçerli bir Classmate yedeği değil (veya farklı sürüm).");
    // Eski biçimli yedek (ör. şube başına tek fiyat) yeni biçime çevrilerek yazılır
    const yeni = veriyiOnar(ham);
    if (yeni?.surum !== SURUM || !Array.isArray(yeni.ogrenciler) || !Array.isArray(yeni.kullanicilar)) return hata(c, "Geçerli bir Classmate yedeği değil (veya farklı sürüm).");
    if (!yeni.kullanicilar.some((k) => k.id === a.kullanici.id && k.aktif && k.rol === "genel-yonetici"))
      return hata(c, "Yedekte sizin aktif genel yönetici hesabınız yok; geri yükleme sizi dışarıda bırakırdı.");
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
  // Kişisel veri tarayıcı/ara katman önbelleğinde kalmasın (çıkıştan sonra da)
  app.use("/api/veli/*", async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
  });
  const hak = (anahtar: string, s: { sinir: number; pencere: number }) => denemeHakki(anahtar, s.sinir, s.pencere);
  const veliBul = (veliId: string) => {
    const v = durum.db.veliler.find((x) => x.id === veliId);
    const cocukVar = v && durum.db.ogrenciler.some((o) => o.veliIds.includes(v.id) && o.durum === "aktif" && aktifKayit(durum.db, o.id));
    return cocukVar ? v : null;
  };

  app.post("/api/veli/kod", async (c) => {
    const { telefon } = await c.req.json<{ telefon: string }>();
    const tel = telefonNormalize(String(telefon ?? ""));
    if (!tel) return hata(c, "Geçerli bir cep telefonu girin.");
    // Sıra önemli: IP sınırına takılan istek numaranın hakkını tüketmesin
    if (!hak(`kodip:${ip(c)}`, GIRIS_SINIRLARI.kodIp) || !hak(`kod:${tel}`, GIRIS_SINIRLARI.kodTelefon) || !hak(`kodgun:${tel}`, GIRIS_SINIRLARI.kodTelefonGun))
      return hata(c, "Çok fazla kod istendi. Bir süre sonra tekrar deneyin.", 429);
    const v = durum.db.veliler.find((x) => telefonNormalize(x.telefon) === tel && veliBul(x.id));
    // Numaranın kayıtlı olup olmadığı sızdırılmaz: aynı yanıt ve /giris'te aynı hata akışı için kayıtsız numaraya da (gönderilmeyen) kod üretilir
    if (!v) {
      kodUret(`veli:${tel}`, "");
      return c.json({ tamam: true });
    }
    const kod = kodUret(`veli:${tel}`, v.id);
    const subeId = cocuklari(v.id).map((o) => aktifKayit(durum.db, o.id)).find(Boolean)?.subeId ?? "s1";
    // Sağlayıcı beklenmez: yanıt süresi numaranın kayıtlı olduğunu ele vermesin
    void kodGonder(tel, kod, v.id, subeId).catch((e) => console.error("Giriş kodu gönderilemedi", e));
    return c.json({ tamam: true, demoKod: demo && sms.ad === "konsol" ? kod : undefined });
  });

  app.post("/api/veli/giris", async (c) => {
    const { telefon, kod } = await c.req.json<{ telefon: string; kod: string }>();
    const tel = telefonNormalize(String(telefon ?? ""));
    if (!tel) return hata(c, "Geçerli bir cep telefonu girin.");
    if (!hak(`girisip:${ip(c)}`, GIRIS_SINIRLARI.girisIp)) return hata(c, "Çok fazla deneme. Bir süre sonra tekrar deneyin.", 429);
    const r = kodDogrula(`veli:${tel}`, String(kod ?? ""));
    if (!r.tamam) return hata(c, kodHataMesaji(r.neden, r.kalan), 401);
    const v = veliBul(r.veri);
    if (!v) return hata(c, kodHataMesaji("hatali"), 401);
    await oturumKapat(vt, getCookie(c, VELI_CEREZ)); // aynı tarayıcıdaki önceki oturum açık kalmasın
    const saat = durum.db.ayarlar.oturumGun * 24;
    cerez(c, VELI_CEREZ, await oturumAc(vt, "veli", v.id, saat, cihaz(c)), saat);
    if (v.portalDavet !== "giris-yapti") await sunucuDegisikligi((x) => (x.veliler = x.veliler.map((y) => (y.id === v.id ? { ...y, portalDavet: "giris-yapti" } : y))));
    return c.json({ tamam: true });
  });

  const veliGerekli = createMiddleware<{ Variables: { aktor: Aktor; veli: Veli } }>(async (c, next) => {
    const o = await oturumBul(vt, getCookie(c, VELI_CEREZ), "veli");
    const v = o && veliBul(o.sahipId);
    if (!v) return hata(c, "Oturum açmanız gerekiyor.", 401);
    if (c.req.method !== "GET" && !c.req.path.endsWith("/cikis") && !hak(`veliyaz:${v.id}`, YAZMA_SINIRLARI.genel)) return hata(c, "Çok fazla istek. Biraz sonra tekrar deneyin.", 429);
    c.set("veli", v);
    await next();
  });
  app.get("/api/veli/ben", veliGerekli, (c) => c.json({ tur: "veli", veli: c.get("veli") }));
  app.get("/api/veli/veri", veliGerekli, (c) => c.json(veliVerisi(durum.db, c.get("veli").id)));
  const pushCihaziVar = async (veliId: string) => (await vt.q("select 1 from push_abonelik where veli_id = $1 limit 1", [veliId])).length > 0;
  app.post("/api/veli/cikis", veliGerekli, async (c) => {
    // Bu cihazın aboneliği silinir (yalnızca kendi kaydı); başka cihazı kalmadıysa kanal SMS'e döner ve "Bildirimleri aç" yeniden çıkar
    const v = c.get("veli");
    const { endpoint } = await c.req.json<{ endpoint?: unknown }>().catch(() => ({ endpoint: undefined }));
    if (typeof endpoint === "string" && endpoint) {
      await vt.q("delete from push_abonelik where endpoint = $1 and veli_id = $2", [endpoint, v.id]);
      if (v.pushAcik && !(await pushCihaziVar(v.id))) await sunucuDegisikligi((x) => (x.veliler = x.veliler.map((y) => (y.id === v.id ? { ...y, pushAcik: false } : y))));
    }
    await oturumKapat(vt, getCookie(c, VELI_CEREZ));
    deleteCookie(c, VELI_CEREZ, { path: "/" });
    return c.json({ tamam: true });
  });

  const cocukMu = (veliId: string, ogrenciId: string) => cocuklari(veliId).some((o) => o.id === ogrenciId && aktifKayit(durum.db, o.id));

  app.post("/api/veli/izin", veliGerekli, async (c) => {
    const v = c.get("veli");
    const { ogrenciId, tarih, not } = await c.req.json<{ ogrenciId: string; tarih: string; not: string }>();
    if (!cocukMu(v.id, ogrenciId)) return hata(c, "Bu öğrenci için işlem yapamazsınız.", 403);
    if (!hak(`izin:${v.id}`, YAZMA_SINIRLARI.izin)) return hata(c, "Çok fazla istek. Bir saat sonra tekrar deneyin.", 429);
    const engel = izinEngeli({ ogrenciId, tarih }, durum.db, BUGUN);
    if (engel) return hata(c, engel);
    await sunucuDegisikligi((x) => {
      if (izinEngeli({ ogrenciId, tarih }, x, BUGUN)) return; // eşzamanlı aynı istek
      x.izinler.push({ id: yeniId("iz"), ogrenciId, tarih, not: String(not ?? "").slice(0, 300) || "Veli bildirdi", veliId: v.id, olusturma: simdiZaman() });
      islemYaz(x, tamAd(v), "İzin bildirimi", `${tamAd(x.ogrenciler.find((o) => o.id === ogrenciId))} — ${tarih}`, aktifKayit(x, ogrenciId)?.subeId);
    });
    return c.json({ tamam: true });
  });

  // Bölüm 09: kurallar yazma kuyruğunun içinde değerlendirilir; aynı anda gelen iki istekten ikincisi dolu görür
  app.post("/api/veli/randevu", veliGerekli, async (c) => {
    const v = c.get("veli");
    const { ogrenciId, ogretmenId, tarih, bas } = await c.req.json<{ ogrenciId: string; ogretmenId: string; tarih: string; bas: string }>();
    if (!durum.db.moduller.etut) return hata(c, "Etüt modülü kapalı.", 403);
    if (!cocukMu(v.id, ogrenciId)) return hata(c, "Bu öğrenci için işlem yapamazsınız.", 403);
    // Her randevu onay bildirimi üretir (SMS maliyeti): al-iptal döngüsü sınırlanır
    if (!hak(`randevu:${v.id}`, YAZMA_SINIRLARI.randevu)) return hata(c, "Çok fazla istek. Bir saat sonra tekrar deneyin.", 429);
    const sonuc: { engel: string | null } = { engel: null };
    await sunucuDegisikligi((x) => {
      const plan = veliRandevuPlani(x, { ogrenciId, ogretmenId, tarih, bas }, { bugun: BUGUN, simdi: SIMDI });
      if ("hata" in plan) {
        sonuc.engel = plan.hata;
        return;
      }
      const randevu = { ...plan.randevu, id: yeniId("r") };
      x.randevular.push(randevu);
      // Randevu onayı: birincil veliye, randevuya bağlı; SMS izni kapalıysa SMS gitmez
      const n = x.gonderimler.length;
      bildirimEkle(x, "etutHatirlatma", ogrenciId, { tarih: randevu.tarih.split("-").reverse().join("."), saat: randevu.bas, ogretmen: personelAdi(x, randevu.ogretmenId) }, undefined, true);
      for (const g of x.gonderimler.slice(n)) {
        g.randevuId = randevu.id;
        smsIzniUygula(g, x.veliler);
      }
      islemYaz(x, tamAd(v), "Etüt randevusu (veli)", `${tamAd(x.ogrenciler.find((o) => o.id === ogrenciId))} — ${randevu.tarih} ${randevu.bas}`, randevu.subeId);
    });
    if (sonuc.engel) return hata(c, sonuc.engel, sonuc.engel === SLOT_DOLU ? 409 : 400);
    void kuyrukCalistir();
    return c.json({ tamam: true });
  });

  app.post("/api/veli/randevu/:id/iptal", veliGerekli, async (c) => {
    const v = c.get("veli");
    const id = c.req.param("id");
    if (!durum.db.moduller.etut) return hata(c, "Etüt modülü kapalı.", 403);
    const cocukIds = new Set(cocuklari(v.id).map((o) => o.id));
    const sonuc: { engel: string | null; bulunamadi: boolean } = { engel: null, bulunamadi: false };
    await sunucuDegisikligi((x) => {
      const r = x.randevular.find((y) => y.id === id);
      if (!r || !r.ogrenciIds.some((o) => cocukIds.has(o))) {
        sonuc.bulunamadi = true;
        return;
      }
      sonuc.engel = veliIptalEngeli(r, x.ayarlar.etutIptalSaat, { bugun: BUGUN, simdi: SIMDI });
      if (sonuc.engel) return;
      x.randevular = x.randevular.map((y) => (y.id === id ? ogrencileriCikar(y, cocukIds) : y));
      islemYaz(x, tamAd(v), "Etüt iptali (veli)", `${r.tarih} ${r.bas}`, r.subeId);
    });
    if (sonuc.bulunamadi) return hata(c, "Randevu bulunamadı.", 404);
    if (sonuc.engel) return hata(c, sonuc.engel);
    return c.json({ tamam: true });
  });

  app.post("/api/veli/tercih", veliGerekli, async (c) => {
    const v = c.get("veli");
    const b = await c.req.json<Partial<Pick<Veli, "pushAcik" | "izinSms" | "izinTanitim">>>();
    const p: Partial<Veli> = {};
    for (const k of ["pushAcik", "izinSms", "izinTanitim"] as const) if (typeof b[k] === "boolean") p[k] = b[k];
    // Bildirimi kapatan velinin cihazlarına push gitmesin (yalnızca kendi abonelikleri)
    if (p.pushAcik === false) await vt.q("delete from push_abonelik where veli_id = $1", [v.id]);
    // Cihaz aboneliği olmadan "bildirim açık" işaretlenmez
    if (p.pushAcik === true && !(await pushCihaziVar(v.id))) return hata(c, "Önce bu cihazda bildirim izni verin.", 409);
    await sunucuDegisikligi((x) => (x.veliler = x.veliler.map((y) => (y.id === v.id ? { ...y, ...p } : y))));
    return c.json({ tamam: true });
  });

  app.post("/api/veli/okundu", veliGerekli, async (c) => {
    const v = c.get("veli");
    const { duyuruIds } = await c.req.json<{ duyuruIds: string[] }>();
    const ids = new Set((Array.isArray(duyuruIds) ? duyuruIds : []).slice(0, 500).map(String));
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
    if (!denemeHakki(`talep:${v.id}`, 5, 60 * 60_000)) return hata(c, "Çok fazla talep gönderildi. Bir saat sonra tekrar deneyin.", 429);
    const subeId = aktifKayit(durum.db, cocuklari(v.id)[0]?.id ?? "")?.subeId ?? null;
    await sunucuDegisikligi((x) => islemYaz(x, tamAd(v), "Bilgi güncelleme talebi", t, subeId));
    return c.json({ tamam: true });
  });

  app.post("/api/veli/push/abone", veliGerekli, async (c) => {
    const v = c.get("veli");
    const { abonelik: ham } = await c.req.json<{ abonelik: unknown }>();
    const abonelik = pushAbonelikTemizle(ham);
    if (!abonelik) return hata(c, "Geçersiz abonelik.");
    if (!denemeHakki(`push:${v.id}`, 20, 60 * 60_000)) return hata(c, "Çok fazla istek. Bir saat sonra tekrar deneyin.", 429);
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
