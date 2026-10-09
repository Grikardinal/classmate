/**
 * Saf iş kuralları — arayüzden bağımsız, birim testleri src/lib/kurallar.test.ts içinde.
 * Her fonksiyonun yanında dayandığı bölüm numarası yazılıdır.
 */

/* ---------- Tarih / saat ---------- */
export function dakika(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** ISO tarih (YYYY-MM-DD) → 1=Pzt … 7=Paz */
export function haftaGunu(iso: string): number {
  const d = new Date(iso + "T00:00:00").getDay();
  return d === 0 ? 7 : d;
}

export function tarihEkle(iso: string, gun: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + gun);
  return isoTarih(d);
}

export function isoTarih(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const g = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${g}`;
}

export function gunFarki(a: string, b: string): number {
  return Math.round((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86400000);
}

/** Haftanın pazartesisi */
export function haftaBasi(iso: string): string {
  return tarihEkle(iso, 1 - haftaGunu(iso));
}

/* ---------- Telefon ve isim (04, 14) ---------- */

/** Telefonu tek formata çevirir: 05xx xxx xx xx. Geçersizse null. */
export function telefonNormalize(girdi: string): string | null {
  let n = String(girdi ?? "").replace(/\D/g, "");
  if (n.startsWith("90") && n.length === 12) n = n.slice(2);
  if (n.length === 10 && n.startsWith("5")) n = "0" + n;
  if (n.length !== 11 || !n.startsWith("05")) return null;
  return `${n.slice(0, 4)} ${n.slice(4, 7)} ${n.slice(7, 9)} ${n.slice(9, 11)}`;
}

/** "Ayşe Nur Yılmaz" → { ad: "Ayşe Nur", soyad: "Yılmaz" } */
export function adSoyadBol(tam: string): { ad: string; soyad: string } {
  const parcalar = String(tam ?? "").trim().split(/\s+/).filter(Boolean);
  if (parcalar.length <= 1) return { ad: parcalar[0] ?? "", soyad: "" };
  return { ad: parcalar.slice(0, -1).join(" "), soyad: parcalar[parcalar.length - 1] };
}

/** Türkçe tamlayan eki (ünlü uyumu): Ayşe'nin, Ecrin'in, Duru'nun, Ömer'in, Alp'ın */
export function iyelik(ad: string): string {
  const k = ad.toLocaleLowerCase("tr-TR");
  const unluler = [...k].filter((c) => "aeıioöuü".includes(c));
  const son = unluler[unluler.length - 1] ?? "e";
  const unlu = "aı".includes(son) ? "ı" : "ei".includes(son) ? "i" : "ou".includes(son) ? "u" : "ü";
  const unluyleBiter = "aeıioöuü".includes(k[k.length - 1]);
  return `${ad}'${unluyleBiter ? "n" : ""}${unlu}n`;
}

export function normalAd(s: string): string {
  return s.toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
}

/** Aynı ad-soyad ve aynı veli telefonu → mükerrer öğrenci (04, 14) */
export function mukerrerMi(
  aday: { ad: string; soyad: string; veliTelefon: string },
  mevcut: { ad: string; soyad: string; veliTelefonlari: string[] }[],
): boolean {
  const tel = telefonNormalize(aday.veliTelefon);
  const ad = normalAd(`${aday.ad} ${aday.soyad}`);
  return mevcut.some((m) => normalAd(`${m.ad} ${m.soyad}`) === ad && !!tel && m.veliTelefonlari.includes(tel));
}

/** Sözleşme numarası şube kodu ile başlar ve şube içinde sıralıdır: MRK-2026-0042 (04) */
export function sozlesmeNo(subeKod: string, yil: number, mevcutNolar: string[]): string {
  const onek = `${subeKod}-${yil}-`;
  const enBuyuk = mevcutNolar
    .filter((n) => n.startsWith(onek))
    .map((n) => Number(n.slice(onek.length)))
    .reduce((a, b) => Math.max(a, b), 0);
  return `${onek}${String(enBuyuk + 1).padStart(4, "0")}`;
}

/* ---------- Ders programı (06) ---------- */
export type Slot = {
  id: string;
  gun: number;
  bas: number;
  bit: number;
  ogretmenId: string;
  derslikId: string;
  grupId: string;
  subeId: string;
};

export type Cakisma = { tur: "ogretmen" | "derslik" | "grup"; slot: Slot };

/** Aynı öğretmen, aynı derslik veya aynı grup aynı anda iki yerde olamaz. */
export function cakismaBul(yeni: Slot, mevcut: Slot[]): Cakisma[] {
  const sonuc: Cakisma[] = [];
  for (const s of mevcut) {
    if (s.id === yeni.id || s.gun !== yeni.gun) continue;
    const ortusur = yeni.bas < s.bit && s.bas < yeni.bit;
    if (!ortusur) continue;
    if (s.ogretmenId === yeni.ogretmenId) sonuc.push({ tur: "ogretmen", slot: s });
    if (s.derslikId === yeni.derslikId) sonuc.push({ tur: "derslik", slot: s });
    if (s.grupId === yeni.grupId) sonuc.push({ tur: "grup", slot: s });
  }
  return sonuc;
}

/** Öğretmenin farklı şubelerdeki iki dersi arasında yeterli süre yoksa uyarı (06). */
export function subeGecisUyarisi(yeni: Slot, mevcut: Slot[], minDakika = 30): Slot[] {
  return mevcut.filter((s) => {
    if (s.id === yeni.id || s.gun !== yeni.gun || s.ogretmenId !== yeni.ogretmenId || s.subeId === yeni.subeId) return false;
    const ara = Math.max(yeni.bas - s.bit, s.bas - yeni.bit);
    return ara >= 0 && ara < minDakika;
  });
}

/* ---------- Yoklama (07) ---------- */
export type YoklamaDurumu = "geldi" | "gelmedi" | "gec" | "izinli";

export function devamsizlikOzeti(durumlar: YoklamaDurumu[]) {
  const toplam = durumlar.length;
  const gelmedi = durumlar.filter((d) => d === "gelmedi").length;
  const izinli = durumlar.filter((d) => d === "izinli").length;
  const gec = durumlar.filter((d) => d === "gec").length;
  return {
    toplam,
    gelmedi,
    izinli,
    gec,
    /** İzinli devamsızlık ayrı gösterilir, orana katılmaz */
    oran: toplam ? gelmedi / toplam : 0,
    izinliOran: toplam ? izinli / toplam : 0,
  };
}

/** Yoklama alınmadıysa dersin başlamasından 15 dk sonra hatırlatma (07). */
export function yoklamaGecikti(dersBaslangic: string, simdi: string, esikDakika = 15): boolean {
  return dakika(simdi) - dakika(dersBaslangic) >= esikDakika;
}

/** Bir sonraki durum: geldi → gelmedi → geç → izinli → geldi (07, hızlı dokunma) */
export function sonrakiDurum(d: YoklamaDurumu): YoklamaDurumu {
  const sira: YoklamaDurumu[] = ["geldi", "gelmedi", "gec", "izinli"];
  return sira[(sira.indexOf(d) + 1) % sira.length];
}

/* ---------- Bildirimler (10) ---------- */
export type VarsayilanKanal = "push" | "sms" | "push+sms";

/** "uygulama + SMS": push gönderilir; veli push'u açmamışsa SMS gider (yedek mantığı). */
export function kanalSec(varsayilan: VarsayilanKanal, pushAcik: boolean): "push" | "sms" {
  if (varsayilan === "sms") return "sms";
  if (varsayilan === "push+sms") return pushAcik ? "push" : "sms";
  return "push";
}

export function sablonDoldur(sablon: string, degiskenler: Record<string, string>): string {
  return sablon.replace(/\{(\w+)\}/g, (tam, ad: string) => degiskenler[ad] ?? tam);
}

/** Gönderim saat aralığı (örn. 08:00–21:00) dışındaysa bir sonraki uygun zamana ertelenir. */
export function gonderimSaatindeMi(saat: string, bas: string, bit: string): boolean {
  const s = dakika(saat);
  return s >= dakika(bas) && s <= dakika(bit);
}

/** SMS uzunluğu: 160 karakter (Türkçe karakterli 155 yerine basit hesap: 160) başına 1 birim */
export function smsBoyu(metin: string): number {
  return Math.max(1, Math.ceil(metin.length / 160));
}

/* ---------- Finans (05) ---------- */
export type PlanTaksit = { no: number; vade: string; tutar: number };

/**
 * Peşinat + N taksit. Tutarlar kuruş hassasiyetinde; küsurat son taksite eklenir.
 * Peşinat varsa no=0 olarak ilk vade tarihinde döner.
 */
export function taksitPlani(net: number, pesinat: number, taksitSayisi: number, ilkVade: string): PlanTaksit[] {
  const sonuc: PlanTaksit[] = [];
  const netKurus = Math.round(net * 100);
  const pesinatKurus = Math.min(Math.round(pesinat * 100), netKurus);
  if (pesinatKurus > 0) sonuc.push({ no: 0, vade: ilkVade, tutar: pesinatKurus / 100 });
  const kalan = netKurus - pesinatKurus;
  if (taksitSayisi <= 0 || kalan <= 0) return sonuc;
  const birim = Math.floor(kalan / taksitSayisi);
  const [y, m, g] = ilkVade.split("-").map(Number);
  for (let i = 0; i < taksitSayisi; i++) {
    const d = new Date(y, m - 1 + i + (pesinatKurus > 0 ? 1 : 0), 1);
    const sonGun = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(g, sonGun));
    const tutar = i === taksitSayisi - 1 ? kalan - birim * (taksitSayisi - 1) : birim;
    sonuc.push({ no: i + 1, vade: isoTarih(d), tutar: tutar / 100 });
  }
  return sonuc;
}

/** Ödeme en eski açık taksitten başlayarak dağıtılır; fazla ödeme sonraki taksite aktarılır. */
export function tahsilatDagit(
  tutar: number,
  acik: { id: string; kalan: number }[],
): { dagilim: { taksitId: string; tutar: number }[]; artan: number } {
  let kalanKurus = Math.round(tutar * 100);
  const dagilim: { taksitId: string; tutar: number }[] = [];
  for (const t of acik) {
    if (kalanKurus <= 0) break;
    const borc = Math.round(t.kalan * 100);
    if (borc <= 0) continue;
    const odenen = Math.min(borc, kalanKurus);
    dagilim.push({ taksitId: t.id, tutar: odenen / 100 });
    kalanKurus -= odenen;
  }
  return { dagilim, artan: kalanKurus / 100 };
}

export function gecikmeGunu(vade: string, bugun: string): number {
  return Math.max(0, gunFarki(vade, bugun));
}

/** Hatırlatma günleri: vadeden 3 gün önce, vade günü, gecikmede 3. ve 10. gün (05) */
export function hatirlatmaGunuMu(vade: string, bugun: string, gunler = [-3, 0, 3, 10]): boolean {
  return gunler.includes(gunFarki(vade, bugun));
}

export function tl(n: number): string {
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: 2 });
}

/* ---------- Hak ediş (13) ---------- */
export type UcretTipi = "sabit" | "ders" | "karma";
export function hakEdis(tip: UcretTipi, dersSayisi: number, dersUcreti: number, sabit: number): number {
  if (tip === "sabit") return sabit;
  if (tip === "ders") return dersSayisi * dersUcreti;
  return sabit + dersSayisi * dersUcreti;
}

/* ---------- Excel içe aktarma (14) ---------- */
export type IceAktarmaAlani = "adSoyad" | "ad" | "soyad" | "seviye" | "okul" | "veliAdSoyad" | "veliTelefon" | "grup" | "sube" | "dogum";

export const iceAktarmaAlanlari: { key: IceAktarmaAlani; ad: string; zorunlu?: boolean; ipuclari: string[] }[] = [
  { key: "adSoyad", ad: "Öğrenci adı soyadı (tek sütun)", ipuclari: ["öğrenci adı soyadı", "ad soyad", "öğrenci", "adı soyadı"] },
  { key: "ad", ad: "Öğrenci adı", ipuclari: ["ad", "adı", "öğrenci adı"] },
  { key: "soyad", ad: "Öğrenci soyadı", ipuclari: ["soyad", "soyadı"] },
  { key: "seviye", ad: "Sınıf seviyesi (3–8)", zorunlu: true, ipuclari: ["sınıf", "seviye", "sinif"] },
  { key: "okul", ad: "Okulu", ipuclari: ["okul", "okulu"] },
  { key: "dogum", ad: "Doğum tarihi", ipuclari: ["doğum", "doğum tarihi", "dogum"] },
  { key: "veliAdSoyad", ad: "Veli adı soyadı", ipuclari: ["veli", "veli adı", "veli adı soyadı", "veli ad soyad"] },
  { key: "veliTelefon", ad: "Veli telefonu", zorunlu: true, ipuclari: ["veli tel", "telefon", "veli telefon", "tel", "gsm"] },
  { key: "grup", ad: "Grup", ipuclari: ["grup", "şube/grup", "sınıf adı"] },
  { key: "sube", ad: "Şube", ipuclari: ["şube", "sube", "kurum şubesi"] },
];

/** Sütun başlıklarından otomatik eşleştirme önerisi */
export function sutunEslestir(basliklar: string[]): Partial<Record<IceAktarmaAlani, number>> {
  const sonuc: Partial<Record<IceAktarmaAlani, number>> = {};
  const kullanilan = new Set<number>();
  const n = basliklar.map(normalAd);
  // Önce tam eşleşme, sonra içerme
  for (const tur of ["tam", "icerir"] as const) {
    for (const alan of iceAktarmaAlanlari) {
      if (sonuc[alan.key] !== undefined) continue;
      const i = n.findIndex(
        (b, idx) =>
          !kullanilan.has(idx) && alan.ipuclari.some((ip) => (tur === "tam" ? b === ip : b.includes(ip) && ip.length > 3)),
      );
      if (i >= 0) {
        sonuc[alan.key] = i;
        kullanilan.add(i);
      }
    }
  }
  if (sonuc.adSoyad !== undefined && (sonuc.ad !== undefined || sonuc.soyad !== undefined)) {
    // Ayrı ad/soyad sütunu varsa tek sütunlu eşleşmeyi bırak
    if (sonuc.ad !== undefined && sonuc.soyad !== undefined) delete sonuc.adSoyad;
  }
  return sonuc;
}

export type IceAktarmaSatiri = {
  satirNo: number;
  ad: string;
  soyad: string;
  seviye: number | null;
  okul: string;
  dogum: string;
  veliAd: string;
  veliSoyad: string;
  veliTelefon: string | null;
  grupAdi: string;
  subeAdi: string;
  hatalar: string[];
  uyarilar: string[];
};

export function satirCoz(
  satir: string[],
  eslesme: Partial<Record<IceAktarmaAlani, number>>,
  satirNo: number,
): IceAktarmaSatiri {
  const al = (k: IceAktarmaAlani) => (eslesme[k] !== undefined ? String(satir[eslesme[k]!] ?? "").trim() : "");
  let ad = al("ad");
  let soyad = al("soyad");
  if (eslesme.adSoyad !== undefined && (!ad || !soyad)) ({ ad, soyad } = adSoyadBol(al("adSoyad")));
  const seviyeHam = al("seviye").match(/\d+/)?.[0];
  const seviye = seviyeHam ? Number(seviyeHam) : null;
  const veli = adSoyadBol(al("veliAdSoyad"));
  const telHam = al("veliTelefon");
  const veliTelefon = telefonNormalize(telHam);
  const hatalar: string[] = [];
  const uyarilar: string[] = [];
  if (!ad) hatalar.push("Öğrenci adı boş");
  if (!soyad) uyarilar.push("Soyad yok");
  if (seviye === null) hatalar.push("Sınıf seviyesi boş");
  else if (seviye < 3 || seviye > 8) hatalar.push(`Seviye 3–8 arası olmalı (${seviye})`);
  if (!telHam) hatalar.push("Veli telefonu boş");
  else if (!veliTelefon) hatalar.push(`Hatalı telefon: ${telHam}`);
  return {
    satirNo,
    ad,
    soyad,
    seviye,
    okul: al("okul"),
    dogum: al("dogum"),
    veliAd: veli.ad,
    veliSoyad: veli.soyad || soyad,
    veliTelefon,
    grupAdi: al("grup"),
    subeAdi: al("sube"),
    hatalar,
    uyarilar,
  };
}

/* ---------- Personel içe aktarma (14) ---------- */
export type PersonelAlani = "adSoyad" | "gorev" | "telefon" | "eposta" | "sube" | "brans";
export const personelAlanlari: { key: PersonelAlani; ad: string; zorunlu?: boolean; ipuclari: string[] }[] = [
  { key: "adSoyad", ad: "Ad soyad", zorunlu: true, ipuclari: ["ad soyad", "adı soyadı", "personel", "isim", "ad"] },
  { key: "gorev", ad: "Görev", zorunlu: true, ipuclari: ["görev", "unvan", "rol", "pozisyon"] },
  { key: "telefon", ad: "Cep telefonu", zorunlu: true, ipuclari: ["telefon", "tel", "cep", "gsm"] },
  { key: "eposta", ad: "E-posta", ipuclari: ["e-posta", "eposta", "mail", "e-mail"] },
  { key: "sube", ad: "Şube(ler)", ipuclari: ["şube", "sube", "şubeler"] },
  { key: "brans", ad: "Branş(lar)", ipuclari: ["branş", "brans", "ders", "alan"] },
];

export function basliklariEslestir<K extends string>(basliklar: string[], alanlar: { key: K; ipuclari: string[] }[]): Partial<Record<K, number>> {
  const n = basliklar.map(normalAd);
  const sonuc: Partial<Record<K, number>> = {};
  const kullanilan = new Set<number>();
  for (const tur of ["tam", "icerir"] as const)
    for (const a of alanlar) {
      if (sonuc[a.key] !== undefined) continue;
      const i = n.findIndex((b, idx) => !kullanilan.has(idx) && a.ipuclari.some((ip) => (tur === "tam" ? b === ip : b.includes(ip) && ip.length > 2)));
      if (i >= 0) {
        sonuc[a.key] = i;
        kullanilan.add(i);
      }
    }
  return sonuc;
}

/** "Öğretmen", "şube müdürü", "sekreter", "kayıt" → rol */
export function gorevCoz(s: string): "ogretmen" | "sube-muduru" | "sekreter" | "genel-yonetici" | null {
  const g = normalAd(s);
  if (!g) return null;
  if (g.includes("öğretmen") || g.includes("ogretmen") || g.includes("eğitmen")) return "ogretmen";
  if (g.includes("müdür") || g.includes("mudur")) return g.includes("genel") ? "genel-yonetici" : "sube-muduru";
  if (g.includes("sekreter") || g.includes("kayıt") || g.includes("danışma")) return "sekreter";
  if (g.includes("yönetici")) return "genel-yonetici";
  return null;
}

export const epostaGecerli = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

/** Basit CSV ayrıştırıcı (; veya , ayraç, tırnak desteği) */
export function csvCoz(metin: string): string[][] {
  const satirlar = metin.replace(/^﻿/, "").split(/\r?\n/).filter((s) => s.trim() !== "");
  if (!satirlar.length) return [];
  const ayrac = (satirlar[0].match(/;/g)?.length ?? 0) >= (satirlar[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  return satirlar.map((s) => {
    const hucreler: string[] = [];
    let cur = "";
    let tirnak = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '"') {
        if (tirnak && s[i + 1] === '"') {
          cur += '"';
          i++;
        } else tirnak = !tirnak;
      } else if (c === ayrac && !tirnak) {
        hucreler.push(cur);
        cur = "";
      } else cur += c;
    }
    hucreler.push(cur);
    return hucreler.map((h) => h.trim());
  });
}

export function csvOlustur(satirlar: (string | number)[][]): string {
  const kac = (v: string | number) => {
    const s = String(v ?? "");
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + satirlar.map((r) => r.map(kac).join(";")).join("\r\n");
}

/** Seçili kişinin verisini anonimleştirme (14 · KVKK) */
export function anonimlestir(ad: string): string {
  return ad ? ad[0] + "***" : "***";
}
