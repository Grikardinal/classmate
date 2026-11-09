/**
 * Bildirim gönderimi (Bölüm 10): SMS sağlayıcısı + web push + gönderim kuyruğu.
 *
 * SMS_SAGLAYICI ortam değişkeni:
 *   konsol (varsayılan) — SMS gönderilmez, sunucu konsoluna yazılır (geliştirme / demo)
 *   netgsm             — NETGSM_KULLANICI, NETGSM_SIFRE, NETGSM_BASLIK gerekir
 * Web push: VAPID anahtarları VAPID_PUBLIC / VAPID_PRIVATE ile verilir; yoksa ilk açılışta üretilip veritabanında saklanır.
 */
import webpush from "web-push";
import { SIMDI, simdiZaman, smsBoyuMaliyet, tamAd, type Db, type Gonderim } from "../src/data/model";
import { gonderimSaatindeMi, telefonNormalize } from "../src/lib/kurallar";
import { RIZA_YOK_HATA, netgsmYanitiCoz, sirlariGizle } from "../src/bolumler/10-iletisim/kurallar";
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
      return netgsmYanitiCoz(r.status, await r.text());
    } catch (e) {
      // Hata metni gönderim kaydında görünür: URL'deki kimlik bilgileri sızmasın
      return { tamam: false, hata: `Netgsm bağlantı hatası: ${sirlariGizle((e as Error).message, [this.sifre, this.kullanici]).slice(0, 200)}` };
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
        await webpush.sendNotification(abonelik, JSON.stringify(veri), { TTL: 24 * 3600, timeout: 15_000 });
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
  /** Her satırdan önce güncel veri okunur: gönderim sürerken silinen / değişen satır işlenmez */
  db: () => Db;
  sms: SmsSaglayici;
  push: PushGonderici | null;
  abonelikler: (veliId: string) => Promise<{ endpoint: string; abonelik: PushAboneligi }[]>;
  abonelikSil: (endpoint: string) => Promise<void>;
  /** Satırı kalıcı günceller; hata fırlatırsa kuyruk durur (işaret yazılamadan SMS gönderilmez) */
  yamala: (id: string, yama: Partial<Gonderim>) => Promise<void>;
  /** Test için; verilmezse sunucu saati */
  saat?: () => string;
};

/**
 * Bekleyen gönderimleri satır satır işler ve sonucu hemen yazar. İşlenen satır sayısını döndürür.
 * - SMS izni kapalı veliye SMS gitmez (giriş kodu hariç); kuyruğa girdikten sonra kapatılsa da geçerli, satır uygulama bildirimine döner.
 * - Uygulama bildirimi: velinin cihaz aboneliği varsa web push; yoksa olay "uygulama + SMS" ise SMS'e düşer,
 *   değilse portaldaki bildirim kutusunda görünür (iletildi sayılır).
 * - SMS: gönderim saat aralığı dışındaysa sıradaki uygun saate kadar bekler.
 * - Çift SMS engeli: sağlayıcıdan önce gonderimBasladi yazılır. Sonuç yazılamadan süreç düşerse satır takılı kalır;
 *   takiliSatirlar ile başarısız işaretlenir, kendiliğinden yeniden gönderilmez.
 */
export async function kuyruguIsle(b: KuyrukBaglami): Promise<number> {
  const kimlikler = b.db().gonderimler.filter((g) => g.durum === "bekliyor" && !g.gonderimBasladi).map((g) => g.id);
  let islenen = 0;
  for (const id of kimlikler) {
    const db = b.db();
    const g = db.gonderimler.find((x) => x.id === id);
    if (!g || g.durum !== "bekliyor" || g.gonderimBasladi) continue;
    const v = db.veliler.find((x) => x.id === g.veliId);
    let kanal: Gonderim["kanal"] = g.kanal === "sms" && g.olay !== "otp" && v?.izinSms === false ? "push" : g.kanal;
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
      if (ulasti) sonuc = { durum: "iletildi", kanal: "push", maliyet: 0 };
      else if (olay?.kanal === "push+sms" && v && v.izinSms !== false) kanal = "sms"; // yedek
      else sonuc = { durum: "iletildi", kanal: "push", maliyet: 0, hata: subs.length ? "Cihaza ulaşılamadı; portal bildirim kutusunda" : undefined };
    }

    if (kanal === "sms") {
      if (g.adayId && db.adaylar.find((a) => a.id === g.adayId)?.rizaVar !== true) {
        await b.yamala(id, { durum: "basarisiz", kanal: "sms", hata: RIZA_YOK_HATA, maliyet: 0 });
        islenen++;
        continue;
      }
      if (g.olay !== "otp" && !gonderimSaatindeMi(b.saat?.() ?? SIMDI, db.ayarlar.gonderimBas, db.ayarlar.gonderimBit)) continue;
      const telefon = v?.telefon ?? g.alici.split("·").pop()?.trim() ?? "";
      await b.yamala(id, { gonderimBasladi: simdiZaman() });
      let r: SmsSonucu;
      try {
        r = await b.sms.gonder(telefon, g.metin);
      } catch {
        r = { tamam: false, hata: "SMS sağlayıcısı yanıt vermedi" };
      }
      sonuc = r.tamam
        ? { gonderimBasladi: undefined, durum: "iletildi", kanal: "sms", maliyet: smsBoyuMaliyet(db, g.metin) }
        : { gonderimBasladi: undefined, durum: "basarisiz", kanal: "sms", hata: r.hata, maliyet: 0 };
    }

    await b.yamala(id, { ...sonuc, alici: v ? `${tamAd(v)} · ${v.telefon}` : g.alici });
    islenen++;
  }
  return islenen;
}
