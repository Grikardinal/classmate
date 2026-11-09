/**
 * Bölüm 12 · Yönetim paneli — saf hesaplar (kartlar, grafikler, şube karşılaştırma, görünürlük, CSV).
 * Tarih, sezon ve şube parametre olarak gelir; saat okunmaz. Yalnızca göreli içe aktarma yapılır (sunucu da kullanır).
 * Tanımlar: README.md · Testler: kurallar.test.ts, sunucu.test.ts
 */
import type { Db, IslemKaydi, Kayit, Odev, Oturum, Rol, Taksit, Yoklama } from "../../data/model";
import { devamsizlikOzeti, yoklamaGecikti, type YoklamaDurumu } from "../../lib/kurallar";
import { beklenenTahsil, vadesiGecenler, yuzde } from "../05-finans/kurallar";

export type SubeSuzgeci = (subeId: string | null | undefined) => boolean;
type Grup = Db["gruplar"][number];

/* ---------- Selamlama ---------- */
export function selamla(saat: string): string {
  const h = Number(saat.slice(0, 2));
  if (h >= 5 && h < 12) return "Günaydın";
  if (h >= 12 && h < 18) return "İyi günler";
  if (h >= 18 && h < 23) return "İyi akşamlar";
  return "İyi geceler";
}

/* ---------- Görünürlük ---------- */
/**
 * Panelin finans bölümleri: modül açık, 05 yetkisi var ve rol genel yönetici / şube müdürü (doküman, iş kuralları).
 * 05 yetkisi alınmış müdüre sunucu taksit göndermez; yetki bakılmazsa kartlar sıfır görünür ve /finans'a gider.
 */
export function finansPanelGorur(rol: Rol, finansModulu: boolean, finansYetkisi: boolean): boolean {
  return finansModulu && finansYetkisi && (rol === "genel-yonetici" || rol === "sube-muduru");
}

/** İşlem kaydı detayında tutar veya indirim taşıyan işlemler: finans görmeyene gitmez (panel ve okumaSuz) */
const FINANS_ISLEMLERI = new Set([
  "Tahsilat", "Tahsilat iptali", "Gider", "Gider iptali", "Virman", "Virman iptali", "İade", "İade iptali",
  "İptal hesabı", "İndirim onayı", "İndirim reddi", "Ödeme hatırlatma", "Fiyat listesi", "Cayma bedeli",
]);
export const finansIslemiMi = (islem: string) => FINANS_ISLEMLERI.has(islem);

/**
 * Son işlemler: yeniden eskiye, görünür şubeler. Şubesiz (kurum geneli) işlem yalnızca tüm kapsam seçiliyken görünür;
 * finans görmeyene tutarlı işlem gösterilmez.
 */
export function sonIslemler(islemler: IslemKaydi[], secenek: { sg: SubeSuzgeci; tumKapsam: boolean; finans: boolean; adet?: number }): IslemKaydi[] {
  return islemler
    .filter((i) => (i.subeId ? secenek.sg(i.subeId) : secenek.tumKapsam) && (secenek.finans || !finansIslemiMi(i.islem)))
    .sort((a, b) => b.zaman.localeCompare(a.zaman))
    .slice(0, secenek.adet ?? 7);
}

/* ---------- Tarih ---------- */
/** Bugünün ayıyla biten n ay (YYYY-AA, eskiden yeniye). Saat dilimine bağlı Date kullanılmaz. */
export function sonAylar(bugun: string, n = 6): string[] {
  const yil = Number(bugun.slice(0, 4));
  const ay = Number(bugun.slice(5, 7)) - 1;
  return Array.from({ length: n }, (_, i) => {
    const toplam = yil * 12 + ay - (n - 1 - i);
    return `${Math.floor(toplam / 12)}-${String((toplam % 12) + 1).padStart(2, "0")}`;
  });
}

/** Oranı bir ondalıkla yüzdeye çevirir (0,125 → 12,5) */
export const oranYuzde = (oran: number) => Math.round(oran * 1000) / 10;

/* ---------- Kayıt ve doluluk ---------- */
/**
 * Aktif sezon + görünür şubeler. Aktif öğrenci: durumu "aktif" olan kayıt (dondurulmuş, iptal, mezun sayılmaz).
 * Doluluk: aktif kayıt / aktif sezondaki grupların toplam kapasitesi.
 */
export function kayitOzeti(d: Pick<Db, "kayitlar" | "gruplar">, secenek: { sezonId: string; sg: SubeSuzgeci; bugun: string }) {
  const kayitlar = d.kayitlar.filter((k) => k.sezonId === secenek.sezonId && secenek.sg(k.subeId));
  const aktif = kayitlar.filter((k) => k.durum === "aktif");
  const gruplar = d.gruplar.filter((g) => g.sezonId === secenek.sezonId && secenek.sg(g.subeId));
  const kapasite = gruplar.reduce((s, g) => s + g.kapasite, 0);
  const ay = secenek.bugun.slice(0, 7);
  return { kayitlar, aktif, gruplar, kapasite, doluluk: yuzde(aktif.length, kapasite), buAyYeni: aktif.filter((k) => k.tarih.slice(0, 7) === ay).length };
}

/** Aylık yeni kayıt: iptal edilen kayıt yeni kayıt sayılmaz; aktif, dondurulmuş ve mezun sayılır */
export function aylikYeniKayit(kayitlar: Pick<Kayit, "tarih" | "durum">[], aylar: string[]): number[] {
  return aylar.map((a) => kayitlar.filter((k) => k.durum !== "iptal" && k.tarih.startsWith(a)).length);
}

/** Aktif kayıtların seviye dağılımı (3–8) */
export function seviyeDagilimi(aktif: Pick<Kayit, "grupId">[], gruplar: Pick<Grup, "id" | "seviye">[]): { seviye: number; adet: number }[] {
  const seviyeOf = new Map(gruplar.map((g) => [g.id, g.seviye]));
  return [3, 4, 5, 6, 7, 8].map((seviye) => ({ seviye, adet: aktif.filter((k) => seviyeOf.get(k.grupId) === seviye).length }));
}

/* ---------- Yoklama ---------- */
/** Yoklaması gecikmiş ders: geçmiş gün veya bugün başlangıcından eşik kadar sonra */
export function yoklamaBekliyor(o: Pick<Oturum, "id" | "tarih" | "bas">, yoklamalar: Record<string, Yoklama>, bugun: string, simdi: string, esikDk: number): boolean {
  return !yoklamalar[o.id] && (o.tarih < bugun || yoklamaGecikti(o.bas, simdi, esikDk));
}

/** Haftanın dersleri (iptal/tatil elenmiş, bugüne kadar): işlenen, yoklaması alınmayan, devamsızlık */
export function haftaOzeti<T extends Pick<Oturum, "id" | "tarih" | "bas">>(oturumlar: T[], yoklamalar: Record<string, Yoklama>, bugun: string, simdi: string, esikDk: number) {
  const durumlar: YoklamaDurumu[] = oturumlar.flatMap((o) => Object.values(yoklamalar[o.id]?.durumlar ?? {}));
  return {
    planlanan: oturumlar.length,
    islenen: oturumlar.filter((o) => yoklamalar[o.id]).length,
    alinmayan: oturumlar.filter((o) => yoklamaBekliyor(o, yoklamalar, bugun, simdi, esikDk)),
    devam: devamsizlikOzeti(durumlar),
  };
}

/** Kontrol bekleyen ödev (yönetim): aktif sezon grubunda, teslimi gelmiş, kontrol edilmemiş */
export function kontrolBekleyenOdevler(odevler: Pick<Odev, "grupId" | "teslim" | "kontrolEdildi">[], gruplar: Pick<Grup, "id" | "sezonId">[], secenek: { sezonId: string; gorunur: (grupId: string) => boolean; bugun: string }): number {
  const sezonda = new Set(gruplar.filter((g) => g.sezonId === secenek.sezonId).map((g) => g.id));
  return odevler.filter((o) => sezonda.has(o.grupId) && secenek.gorunur(o.grupId) && o.teslim <= secenek.bugun && !o.kontrolEdildi).length;
}

/* ---------- Finans ---------- */
/**
 * Taksit üzerinden hesaplanır: iptal edilen tahsilat taksitin ödenenini geri alır, kayıt iptali tutarı hak edilene indirir;
 * bu yüzden ters kayıtlar burada ayrıca düşülmez. Bu ay: vadesi bu ay olan taksitler.
 */
export function finansOzeti(taksitler: Taksit[], bugun: string) {
  const ay = bugun.slice(0, 7);
  const { beklenen, tahsil } = beklenenTahsil(taksitler.filter((t) => t.vade.startsWith(ay)));
  const geciken = vadesiGecenler(taksitler, bugun);
  const vadesiBugun = taksitler.filter((t) => t.vade === bugun && Math.round((t.tutar - t.odenen) * 100) > 0);
  const gecikenVeli = new Set(geciken.map((t) => t.veliId));
  const bugunVeli = new Set(vadesiBugun.map((t) => t.veliId));
  return {
    beklenen,
    tahsil,
    oran: yuzde(tahsil, beklenen),
    gecikenTutar: beklenenKalan(geciken),
    gecikenVeli: gecikenVeli.size,
    bugunVeli: bugunVeli.size,
    /** Aynı veli iki listede de olabilir; bir kez sayılır */
    takipVeli: new Set([...gecikenVeli, ...bugunVeli]).size,
  };
}

function beklenenKalan(taksitler: Taksit[]): number {
  const { beklenen, tahsil } = beklenenTahsil(taksitler);
  return Math.round((beklenen - tahsil) * 100) / 100;
}

/* ---------- Şube karşılaştırma ---------- */
export type SubeSatiri = { subeId: string; ogrenci: number; doluluk: number; devamsizlik: number; tahsilat: number; acikAday: number };

/** Tüm şubeler görünümü. Devamsızlık aktif sezonun yoklamalarından; tahsilat oranı vadesi gelmiş taksitlerden */
export function subeKarsilastirma(
  subeIds: string[],
  d: { aktif: Pick<Kayit, "subeId">[]; gruplar: Pick<Grup, "id" | "subeId" | "kapasite">[]; yoklamalar: Record<string, Yoklama>; taksitler: Pick<Taksit, "subeId" | "vade" | "tutar" | "odenen">[]; adaylar: { subeId: string }[] },
  bugun: string,
): SubeSatiri[] {
  const grupSube = new Map(d.gruplar.map((g) => [g.id, g.subeId]));
  const durumlar = new Map<string, YoklamaDurumu[]>();
  for (const y of Object.values(d.yoklamalar)) {
    const s = grupSube.get(y.grupId); // sezon dışı grup bu haritada yok
    if (!s) continue;
    const l = durumlar.get(s) ?? [];
    l.push(...Object.values(y.durumlar));
    durumlar.set(s, l);
  }
  return subeIds.map((subeId) => {
    const ogrenci = d.aktif.filter((k) => k.subeId === subeId).length;
    const kapasite = d.gruplar.filter((g) => g.subeId === subeId).reduce((t, g) => t + g.kapasite, 0);
    const { beklenen, tahsil } = beklenenTahsil(d.taksitler.filter((t) => t.subeId === subeId && t.vade <= bugun));
    return {
      subeId,
      ogrenci,
      doluluk: yuzde(ogrenci, kapasite),
      devamsizlik: oranYuzde(devamsizlikOzeti(durumlar.get(subeId) ?? []).oran),
      tahsilat: yuzde(tahsil, beklenen),
      acikAday: d.adaylar.filter((a) => a.subeId === subeId).length,
    };
  });
}

/* ---------- CSV ---------- */
/**
 * Excel'de formül gibi çalışabilecek metni etkisizleştirir (=, +, -, @, sekme ile başlayan hücre; başına ' eklenir).
 * Sayı hücresi metin değildir, dokunulmaz; ondalık ayraç Türkçe Excel için virgüldür ("12.5" tarihe dönüşüyordu).
 */
export function csvHucre(v: string | number): string {
  if (typeof v === "number") return Number.isFinite(v) ? String(v).replace(".", ",") : "";
  const s = String(v ?? "").replace(/[\r\n]+/g, " ");
  return /^[\s]*[=+\-@]/.test(s) || /^[\t]/.test(s) ? `'${s}` : s;
}
