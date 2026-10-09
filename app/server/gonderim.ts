/**
 * Bildirim gönderimi (Bölüm 10): SMS sağlayıcısı + web push + gönderim kuyruğu.
 *
 * SMS_SAGLAYICI ortam değişkeni:
 *   konsol (varsayılan) — SMS gönderilmez, sunucu konsoluna yazılır (geliştirme / demo)
 *   netgsm             — NETGSM_KULLANICI, NETGSM_SIFRE, NETGSM_BASLIK gerekir
 * Web push: VAPID anahtarları VAPID_PUBLIC / VAPID_PRIVATE ile verilir; yoksa ilk açılışta üretilip veritabanında saklanır.
 */
import webpush from "web-push";
import { SIMDI, smsBoyuMaliyet, tamAd, type Db, type Gonderim } from "../src/data/model";
import { gonderimSaatindeMi, telefonNormalize } from "../src/lib/kurallar";
import type { Veritabani } from "./veritabani";

export type SmsSonucu = { tamam: true; ref?: string } | { tamam: false; hata: string };
export interface SmsSaglayici {
  ad: string;
  gonder(telefon: string, metin: string): Promise<SmsSonucu>;
}

/** Geliştirme / demo: gerçek SMS yerine konsola yazar */
export class KonsolSms implements SmsSaglayici {
  ad = "konsol";
  gonderilenler: { telefon: string; metin: string }[] = [];
  async gonder(telefon: string, metin: string): Promise<SmsSonucu> {
    this.gonderilenler.push({ telefon, metin });
    if (process.env.NODE_ENV !== "test") console.log(`[SMS → ${telefon}] ${metin}`);
    return { tamam: true, ref: "konsol" };
  }
}

/** Netgsm HTTP GET API: başarıda "00 <bulkid>" / "01" / "02" döner; diğer kodlar hatadır */
export class NetgsmSms implements SmsSaglayici {
  ad = "netgsm";
  constructor(private kullanici: string, private sifre: string, private baslik: string) {}
  async gonder(telefon: string, metin: string): Promise<SmsSonucu> {
    const no = (telefonNormalize(telefon) ?? "").replace(/\D/g, "").replace(/^0/, "");
    if (!no) return { tamam: false, hata: "Geçersiz telefon" };
    const p = new URLSearchParams({ usercode: this.kullanici, password: this.sifre, gsmno: no, message: metin, msgheader: this.baslik, dil: "TR" });
    try {
      const r = await fetch(`https://api.netgsm.com.tr/sms/send/get?${p}`, { signal: AbortSignal.timeout(15_000) });
      const govde = (await r.text()).trim();
      const kod = govde.split(/\s+/)[0];
      if (["00", "01", "02"].includes(kod)) return { tamam: true, ref: govde.split(/\s+/)[1] };
      const anlam: Record<string, string> = { "20": "Mesaj metni hatalı / çok uzun", "30": "Kullanıcı adı, şifre veya API yetkisi hatalı", "40": "Mesaj başlığı tanımlı değil", "50": "İYS kontrollü gönderim hatası", "70": "Hatalı parametre" };
      return { tamam: false, hata: `Netgsm ${kod}: ${anlam[kod] ?? govde}` };
    } catch (e) {
      return { tamam: false, hata: `Netgsm bağlantı hatası: ${(e as Error).message}` };
    }
  }
}

export function smsSaglayiciOlustur(): SmsSaglayici {
  const tur = process.env.SMS_SAGLAYICI ?? "konsol";
  if (tur === "netgsm") {
    const { NETGSM_KULLANICI: k, NETGSM_SIFRE: s, NETGSM_BASLIK: b } = process.env;
    if (!k || !s || !b) throw new Error("SMS_SAGLAYICI=netgsm için NETGSM_KULLANICI, NETGSM_SIFRE ve NETGSM_BASLIK gerekli");
    return new NetgsmSms(k, s, b);
  }
  return new KonsolSms();
}

/* ---------- Web push ---------- */
export type PushAboneligi = webpush.PushSubscription;
export interface PushGonderici {
  acikAnahtar: string;
  gonder(abonelik: PushAboneligi, veri: object): Promise<{ tamam: boolean; gecersiz?: boolean; hata?: string }>;
}

export async function pushHazirla(vt: Veritabani, iletisim: string): Promise<PushGonderici> {
  let pub = process.env.VAPID_PUBLIC;
  let priv = process.env.VAPID_PRIVATE;
  if (!pub || !priv) {
    const r = await vt.q("select veri from tekil where anahtar = 'vapid'");
    if (r.length) ({ pub, priv } = r[0].veri as { pub: string; priv: string });
    else {
      const k = webpush.generateVAPIDKeys();
      pub = k.publicKey;
      priv = k.privateKey;
      await vt.q("insert into tekil (anahtar, veri) values ('vapid', $1)", [JSON.stringify({ pub, priv })]);
    }
  }
  webpush.setVapidDetails(`mailto:${iletisim}`, pub!, priv!);
  return {
    acikAnahtar: pub!,
    async gonder(abonelik, veri) {
      try {
        await webpush.sendNotification(abonelik, JSON.stringify(veri), { TTL: 24 * 3600 });
        return { tamam: true };
      } catch (e) {
        const kod = (e as { statusCode?: number }).statusCode;
        return { tamam: false, gecersiz: kod === 404 || kod === 410, hata: String((e as Error).message) };
      }
    },
  };
}

/* ---------- Kuyruk ---------- */
export type KuyrukBaglami = {
  db: Db;
  sms: SmsSaglayici;
  push: PushGonderici | null;
  abonelikler: (veliId: string) => Promise<{ endpoint: string; abonelik: PushAboneligi }[]>;
  abonelikSil: (endpoint: string) => Promise<void>;
};

/**
 * Bekleyen gönderimleri işler. Değişen gönderim satırlarını döndürür (çağıran kaydeder).
 * - Uygulama bildirimi: velinin cihaz aboneliği varsa web push; yoksa olay "uygulama + SMS" ise SMS'e düşer,
 *   değilse portaldaki bildirim kutusunda görünür (iletildi sayılır).
 * - SMS: gönderim saat aralığı dışındaysa sıradaki uygun saate kadar bekler (giriş kodu hariç).
 */
export async function kuyruguIsle(b: KuyrukBaglami): Promise<Gonderim[]> {
  const degisen: Gonderim[] = [];
  const { db } = b;
  for (const g of db.gonderimler) {
    if (g.durum !== "bekliyor") continue;
    const v = db.veliler.find((x) => x.id === g.veliId);
    let kanal = g.kanal;
    let sonuc: Partial<Gonderim> = {};

    if (kanal === "push") {
      const olay = db.olaylar.find((o) => o.key === g.olay);
      const subs = v && b.push ? await b.abonelikler(v.id) : [];
      let ulasti = false;
      for (const s of subs) {
        const r = await b.push!.gonder(s.abonelik, { baslik: db.kurum.ad, metin: g.metin, url: "/veli/bildirimler" });
        if (r.tamam) ulasti = true;
        else if (r.gecersiz) await b.abonelikSil(s.endpoint);
      }
      if (ulasti) sonuc = { durum: "iletildi" };
      else if (olay?.kanal === "push+sms" && v?.izinSms !== false) kanal = "sms"; // yedek
      else sonuc = { durum: "iletildi", hata: subs.length ? "Cihaza ulaşılamadı; portal bildirim kutusunda" : undefined };
    }

    if (kanal === "sms") {
      if (g.olay !== "otp" && !gonderimSaatindeMi(SIMDI, db.ayarlar.gonderimBas, db.ayarlar.gonderimBit)) continue;
      const telefon = v?.telefon ?? g.alici.split("·").pop()?.trim() ?? "";
      const r = await b.sms.gonder(telefon, g.metin);
      sonuc = r.tamam ? { durum: "iletildi", kanal: "sms", maliyet: smsBoyuMaliyet(db, g.metin) } : { durum: "basarisiz", kanal: "sms", hata: r.hata, maliyet: 0 };
    }

    const yeni = { ...g, ...sonuc, alici: v ? `${tamAd(v)} · ${v.telefon}` : g.alici };
    degisen.push(yeni);
  }
  return degisen;
}

