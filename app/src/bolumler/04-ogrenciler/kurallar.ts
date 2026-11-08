/**
 * Bölüm 04 · Öğrenci, veli ve kayıt (sözleşme) — saf iş kuralları.
 * Ekran (anında geri bildirim) ve sunucu (server/politika.ts · kayitDenetle, son söz) aynı fonksiyonları kullanır.
 * Bu yüzden yalnızca göreli içe aktarma ve tip içe aktarması yapılır. Testler: kurallar.test.ts
 */
import type { Aday, AdayDurum, Db, Grup, Kayit, Ogrenci, Rol, Veli } from "../../data/model";
import { epostaGecerli, normalAd, sozlesmeNo, telefonNormalize } from "../../lib/kurallar";
import { EN_YUKSEK_SEVIYE } from "../01-kurum-yapisi/kurallar";
import { ANONIM_TELEFON, notlarEklemeMi } from "../03-on-kayit/kurallar";

/** Doğrulama sonucu: null = geçerli, metin = kullanıcıya gösterilecek ilk hata */
export type Hata = string | null;

export const KAYIT_DURUMLARI: { key: Kayit["durum"]; ad: string; renk: "success" | "warning" | "danger" | "secondary" }[] = [
  { key: "aktif", ad: "Aktif", renk: "success" },
  { key: "dondurulmus", ad: "Dondurulmuş", renk: "warning" },
  { key: "iptal", ad: "İptal", renk: "danger" },
  { key: "mezun", ad: "Mezun", renk: "secondary" },
];
/** Süren kayıt: öğrenci grupta sayılır (aktif) ya da geri dönebilir (dondurulmuş) */
export const surenKayitMi = (k: Pick<Kayit, "durum">) => k.durum === "aktif" || k.durum === "dondurulmus";
export const kayitDurumBilgisi = (k: Kayit["durum"]) => KAYIT_DURUMLARI.find((x) => x.key === k) ?? KAYIT_DURUMLARI[0];

export const SEVIYELER = [3, 4, 5, 6, 7, 8] as const;
export const YAKINLIKLAR: Veli["yakinlik"][] = ["Anne", "Baba", "Diğer"];
export const AD_EN_FAZLA = 80;
export const OKUL_EN_FAZLA = 120;
export const SAGLIK_EN_FAZLA = 500;
export const NOT_EN_FAZLA = 2000;
export const EN_FAZLA_VELI = 3;
/** KVKK aydınlatma metni sürümü (kayda yazılır) */
export const KVKK_SURUM = "v1.2";
/** Kapasite aşımını onaylayabilen roller (karar 2026-11-07: sekreter de onaylayabilir) */
export const KAPASITE_ONAYLAYAN_ROLLER: Rol[] = ["genel-yonetici", "sube-muduru", "sekreter"];
/**
 * Kaydı iptal edilen öğrencinin adayı bu duruma döner (kullanıcı kararı 2026-11-07).
 * "Görüşüldü": aileyle daha önce görüşülmüş, yeniden aranması gereken açık aday. Gerekçe README'de.
 */
export const YENIDEN_ACILAN_DURUM: AdayDurum = "gorusuldu";

const isoTarihMi = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s + "T00:00:00").getTime());
const bos = (s: unknown) => typeof s !== "string" || s.trim() === "";
const metinMi = (s: unknown, enFazla: number) => typeof s === "string" && s.length <= enFazla;
/** Alan sırasından bağımsız karşılaştırma (üst düzey alanlar; tanımsız alan yok sayılır) */
const ayni = (a: object, b: object) => {
  const s = (x: object) => JSON.stringify(Object.entries(x).filter(([, v]) => v !== undefined).sort(([p], [q]) => (p < q ? -1 : 1)));
  return s(a) === s(b);
};

/* ---------- Ad karşılaştırma (mükerrer) ---------- */
/**
 * Türkçe harf duyarsız ad anahtarı: büyük/küçük harf (İ/I/ı dahil), fazla boşluk ve
 * Türkçe karakter yerine Latin harf yazımı ("Işıl" = "ISIL" = "isil") farkı yoktur.
 */
export function adAnahtari(s: string): string {
  return normalAd(String(s ?? ""))
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u");
}

/** KVKK (Bölüm 14) ile anonimleştirilmiş öğrenci: ad ve soyad "A***" biçiminde */
export const ogrenciAnonimMi = (o: Pick<Ogrenci, "ad" | "soyad">) => /^\S?\*\*\*$/.test(o.ad) && /^\S?\*\*\*$/.test(o.soyad);
/** KVKK (Bölüm 14) ile anonimleştirilmiş veli: telefon maskeli */
export const veliAnonimMi = (v: Pick<Veli, "telefon">) => v.telefon === ANONIM_TELEFON;

/** Aynı telefonla kayıtlı (anonim olmayan) veli. Telefon farklı yazılsa da (normalize edilerek) bulunur. */
export function telefonSahibiVeli(telefon: string, veliler: Veli[], haricId?: string): Veli | null {
  const tel = telefonNormalize(telefon);
  if (!tel) return null;
  return veliler.find((v) => v.id !== haricId && !veliAnonimMi(v) && telefonNormalize(v.telefon) === tel) ?? null;
}

/**
 * Mükerrer öğrenci: aynı ad-soyad (Türkçe harf duyarsız) ve velilerinden biriyle aynı telefon.
 * Kurum genelinde aranır (sunucu tüm şubeleri görür); anonim ve kendisi hariç.
 */
export function mukerrerOgrenci(
  o: { id?: string; ad: string; soyad: string },
  veliTelefonlari: string[],
  d: Pick<Db, "ogrenciler" | "veliler">,
): Ogrenci | null {
  const ad = adAnahtari(`${o.ad} ${o.soyad}`);
  const tel = new Set(veliTelefonlari.map((t) => telefonNormalize(t)).filter(Boolean) as string[]);
  if (!ad || !tel.size) return null;
  return (
    d.ogrenciler.find((x) => {
      if (x.id === o.id || ogrenciAnonimMi(x) || adAnahtari(`${x.ad} ${x.soyad}`) !== ad) return false;
      return x.veliIds.some((vid) => {
        const v = d.veliler.find((y) => y.id === vid);
        const t = v && telefonNormalize(v.telefon);
        return !!t && tel.has(t);
      });
    }) ?? null
  );
}

/* ---------- Alan kuralları ---------- */
export function ogrenciDogrula(o: Ogrenci, bugun: string): Hata {
  if (!o || typeof o !== "object") return "Öğrenci bilgisi geçersiz.";
  if (bos(o.ad) || bos(o.soyad)) return "Öğrencinin adı ve soyadı zorunlu.";
  if (o.ad.length > AD_EN_FAZLA || o.soyad.length > AD_EN_FAZLA) return `Ad ve soyad en fazla ${AD_EN_FAZLA} karakter olabilir.`;
  if (o.dogum !== "" && !isoTarihMi(o.dogum)) return "Doğum tarihi geçersiz.";
  if (o.dogum && o.dogum > bugun) return "Doğum tarihi bugünden sonra olamaz.";
  if (o.cinsiyet !== "K" && o.cinsiyet !== "E") return "Cinsiyet geçersiz.";
  if (!metinMi(o.okul, OKUL_EN_FAZLA) || !metinMi(o.okulSinifi, 20)) return "Okul bilgisi geçersiz.";
  if (!metinMi(o.saglikNotu, SAGLIK_EN_FAZLA)) return `Sağlık notu en fazla ${SAGLIK_EN_FAZLA} karakter olabilir.`;
  if (o.durum !== "aktif" && o.durum !== "ayrildi" && o.durum !== "mezun") return "Öğrenci durumu geçersiz.";
  if (!Array.isArray(o.veliIds) || o.veliIds.length === 0) return "Öğrencinin en az bir velisi olmalı.";
  if (o.veliIds.length > EN_FAZLA_VELI) return `Bir öğrenciye en fazla ${EN_FAZLA_VELI} veli bağlanabilir.`;
  if (new Set(o.veliIds).size !== o.veliIds.length) return "Aynı veli iki kez bağlanamaz.";
  if (!o.veliIds.includes(o.birincilVeliId)) return "Birincil veli, öğrencinin velilerinden biri olmalı.";
  if (!Array.isArray(o.notlar)) return "Notlar geçersiz.";
  for (const n of o.notlar)
    if (!n || typeof n.metin !== "string" || bos(n.metin) || n.metin.length > NOT_EN_FAZLA || typeof n.yazar !== "string" || typeof n.tarih !== "string")
      return `Not boş olamaz ve en fazla ${NOT_EN_FAZLA} karakter olabilir.`;
  return null;
}

export function veliDogrula(v: Veli): Hata {
  if (!v || typeof v !== "object") return "Veli bilgisi geçersiz.";
  if (bos(v.ad)) return "Veli adı zorunlu.";
  if (v.ad.length > AD_EN_FAZLA || !metinMi(v.soyad, AD_EN_FAZLA)) return `Ad ve soyad en fazla ${AD_EN_FAZLA} karakter olabilir.`;
  if (!telefonNormalize(v.telefon)) return "Geçerli bir veli telefonu girin (05xx xxx xx xx).";
  if (typeof v.eposta !== "string" || (v.eposta.trim() !== "" && !epostaGecerli(v.eposta.trim()))) return "Veli e-posta adresi geçersiz.";
  if (!YAKINLIKLAR.includes(v.yakinlik)) return "Yakınlık geçersiz.";
  if (typeof v.izinSms !== "boolean" || typeof v.izinTanitim !== "boolean" || typeof v.pushAcik !== "boolean") return "İletişim izinleri geçersiz.";
  if (!["gonderildi", "giris-yapti", "bekliyor"].includes(v.portalDavet)) return "Portal davet durumu geçersiz.";
  return null;
}

/** Öğrenci notları zaman çizelgesidir: yeni not başa eklenir, eski notlar silinemez/değiştirilemez. */
export function notlarBasaEklemeMi(eski: Ogrenci["notlar"], yeni: Ogrenci["notlar"]): boolean {
  if (!Array.isArray(yeni) || yeni.length < eski.length) return false;
  const kuyruk = yeni.slice(yeni.length - eski.length);
  return eski.every((n, i) => JSON.stringify(n) === JSON.stringify(kuyruk[i]));
}

/* ---------- Sözleşme numarası ---------- */
/** Kaydın yılı: sezonun başlangıç yılı (2026-2027 sezonunun Ocak ayındaki kaydı da 2026 numarası alır) */
export function sozlesmeYili(sezonlar: Db["sezonlar"], sezonId: string, bugun: string): number {
  const b = sezonlar.find((z) => z.id === sezonId)?.baslangic;
  return Number((b && /^\d{4}/.test(b) ? b : bugun).slice(0, 4));
}

/** Yeni kaydın sözleşme numarası: şube kodu + sezon yılı + şube içinde sıra (örn. MRK-2026-0042) */
export function yeniSozlesmeNo(d: Pick<Db, "subeler" | "sezonlar">, mevcutNolar: string[], subeId: string, sezonId: string, bugun: string): string {
  const kod = d.subeler.find((s) => s.id === subeId)?.kod ?? "SUB";
  return sozlesmeNo(kod, sozlesmeYili(d.sezonlar, sezonId, bugun), mevcutNolar);
}

/** Sözleşme numarası boş olamaz, şube koduyla başlar ve kurum genelinde benzersizdir */
export function sozlesmeNoEngeli(k: Pick<Kayit, "id" | "subeId" | "sozlesmeNo">, d: Pick<Db, "subeler" | "kayitlar">): Hata {
  if (bos(k.sozlesmeNo)) return "Sözleşme numarası boş olamaz.";
  const kod = d.subeler.find((s) => s.id === k.subeId)?.kod;
  if (kod && !k.sozlesmeNo.startsWith(`${kod}-`)) return `Sözleşme numarası şube koduyla (${kod}-) başlamalı.`;
  if (d.kayitlar.some((x) => x.id !== k.id && x.sozlesmeNo === k.sozlesmeNo))
    return `Sözleşme numarası ${k.sozlesmeNo} başka bir kayıtta kullanılıyor; sayfayı yenileyip yeniden deneyin.`;
  return null;
}

/* ---------- Grup, şube, sezon, kapasite ---------- */
/** Kaydın grubu: var olmalı, kaydın şubesine ve sezonuna ait olmalı; şube aktif olmalı */
export function grupAtamaEngeli(k: Pick<Kayit, "subeId" | "sezonId" | "grupId">, d: Pick<Db, "gruplar" | "subeler" | "sezonlar">): Hata {
  const s = d.subeler.find((x) => x.id === k.subeId);
  if (!s) return "Kaydın şubesi bulunamadı.";
  if (!s.aktif) return "Pasif şubeye kayıt yapılamaz / nakledilemez.";
  if (!d.sezonlar.some((z) => z.id === k.sezonId)) return "Kaydın sezonu bulunamadı.";
  const g = d.gruplar.find((x) => x.id === k.grupId);
  if (!g) return "Grup bulunamadı.";
  if (g.subeId !== k.subeId) return "Grup, kaydın şubesine ait olmalı.";
  if (g.sezonId !== k.sezonId) return "Grup, kaydın sezonuna ait olmalı.";
  return null;
}

/** Gruptaki aktif kayıt sayısı */
export const grupAktifSayisi = (d: Pick<Db, "kayitlar">, grupId: string) => d.kayitlar.filter((k) => k.grupId === grupId && k.durum === "aktif").length;

/** Gruba bir aktif öğrenci daha eklenirse kapasite aşılır mı (ekran: kayıttan önce) */
export function grupDoluMu(d: Pick<Db, "kayitlar" | "gruplar">, grupId: string): boolean {
  const g = d.gruplar.find((x) => x.id === grupId);
  return !!g && grupAktifSayisi(d, grupId) >= g.kapasite;
}

export const kapasiteOnaylayabilir = (rol: Rol) => KAPASITE_ONAYLAYAN_ROLLER.includes(rol);

/** Seviye uyumu: öğrencinin sınıfı ile grubun seviyesi (uyarı; engel değil) */
export function seviyeUyumsuz(seviye: number, grup: { seviye: number } | undefined): boolean {
  return !!grup && grup.seviye !== seviye;
}

/* ---------- Kayıt durumu ---------- */
/**
 * Kayıt durumu geçişi:
 * - yeni kayıt "aktif" başlar
 * - aktif ⇄ dondurulmuş serbest; her ikisinden iptale geçilebilir
 * - iptal geri alınamaz (geçmiş korunur; yeniden kayıt için yeni kayıt açılır)
 * Mezuniyet ayrı bir durum değildir: sezon geçişinde (Bölüm 01) en üst seviye yeni sezona taşınmaz.
 * Nakil ayrı bir durum değildir: kayıt bozulmadan şube ve grup değişir.
 */
export function kayitDurumGecisEngeli(eski: Kayit["durum"] | null, yeni: Kayit["durum"]): Hata {
  if (!KAYIT_DURUMLARI.some((d) => d.key === yeni)) return "Geçersiz kayıt durumu.";
  if (eski === null) return yeni === "aktif" ? null : "Yeni kayıt aktif durumda açılır.";
  if (eski === "iptal" && yeni !== "iptal") return "İptal edilen kayıt geri alınamaz.";
  if (eski === "mezun" && yeni !== "mezun" && yeni !== "iptal") return "Mezun kayıt geri alınamaz.";
  return null;
}

/**
 * Öğrencinin durumu kayıtlarından çıkar: süren (aktif/dondurulmuş) kaydı varsa "aktif";
 * yoksa mezun kaydı varsa "mezun"; yoksa "ayrıldı". Yeniden kayıt (mevcut kart) öğrenciyi yeniden aktif yapar.
 */
export function ogrenciDurumu(ogrenciId: string, kayitlar: Pick<Kayit, "ogrenciId" | "durum">[]): Ogrenci["durum"] {
  const l = kayitlar.filter((k) => k.ogrenciId === ogrenciId);
  if (l.some(surenKayitMi)) return "aktif";
  return l.some((k) => k.durum === "mezun") ? "mezun" : "ayrildi";
}
/** Kayıt iptalinden sonra öğrencinin durumu (ogrenciDurumu ile aynı) */
export const iptalSonrasiOgrenciDurumu = ogrenciDurumu;

/** Mevcut karttan yeniden kayıt: süren kaydı olmayan (ayrılmış / mezun), anonim olmayan öğrenci */
export function yenidenKayitEngeli(o: Ogrenci | undefined, kayitlar: Pick<Kayit, "ogrenciId" | "durum">[]): Hata {
  if (!o) return "Öğrenci bulunamadı.";
  if (ogrenciAnonimMi(o)) return "Anonimleştirilmiş öğrenci yeniden kaydedilemez.";
  if (kayitlar.some((k) => k.ogrenciId === o.id && surenKayitMi(k))) return "Öğrencinin süren bir kaydı var; yeniden kayıt gerekmez.";
  return null;
}

/* ---------- Kapsam dışındaki şubeye nakil (karar 2026-11-07) ---------- */
/**
 * Nakilde hedef grup: hedef şubede, kaydın sezonunda, mevcut grubun seviyesinde ve (aktif kayıt için) boş kontenjanı olan grup;
 * birden çoksa en boş olanı. Kapsam dışındaki şubenin gruplarını ekran göremediği için grubu sunucu atar.
 */
export function nakilHedefGrubu(d: Pick<Db, "gruplar" | "kayitlar">, kayit: Kayit, hedefSubeId: string): Grup | null {
  const seviye = d.gruplar.find((g) => g.id === kayit.grupId)?.seviye;
  const dolu = (g: Grup) => d.kayitlar.filter((k) => k.id !== kayit.id && k.grupId === g.id && k.durum === "aktif").length;
  const l = d.gruplar
    .filter((g) => g.subeId === hedefSubeId && g.sezonId === kayit.sezonId && g.seviye === seviye && (kayit.durum !== "aktif" || dolu(g) < g.kapasite))
    .sort((a, b) => b.kapasite - dolu(b) - (a.kapasite - dolu(a)));
  return l[0] ?? null;
}

/**
 * Kapsamı dışındaki aktif şubeye nakil (Bölüm 03 aday devri deseni): eski hal kullanıcının kapsamındadır
 * (yazmaDenetle), aynı pakette kayıtta yalnızca şube, grup ve grup geçmişi (sona bir satır) değişir;
 * kayıt aktif sezonda ve sürüyor olmalı; grup nakilHedefGrubu() ile atanır (kapasite aşımı yok).
 */
export function kapsamDisiNakilEngeli(k: Kayit, eski: Kayit, sonraki: Pick<Db, "gruplar" | "kayitlar" | "subeler" | "sezonlar">): Hata {
  if (!surenKayitMi(eski)) return "Yalnızca süren (aktif / dondurulmuş) kayıt nakledilebilir.";
  if (k.durum !== eski.durum) return "Nakille birlikte kayıt durumu değiştirilemez.";
  const hedef = sonraki.subeler.find((s) => s.id === k.subeId);
  if (!hedef) return "Hedef şube bulunamadı.";
  if (!hedef.aktif) return "Pasif şubeye kayıt yapılamaz / nakledilemez.";
  if (!sonraki.sezonlar.find((z) => z.id === k.sezonId)?.aktif) return "Yalnızca aktif sezonun kaydı başka şubeye nakledilebilir.";
  const disi = (x: Kayit) => ({ ...x, subeId: "", grupId: "", grupGecmisi: [] });
  if (!ayni(disi(k), disi(eski))) return "Başka şubeye nakilde kaydın diğer bilgileri değiştirilemez.";
  const g = nakilHedefGrubu(sonraki, eski, k.subeId);
  if (!g) return "Hedef şubede aynı seviyede boş kontenjanlı grup yok.";
  if (k.grupId !== g.id) return "Nakilde grup, hedef şubenin uygun grubu olmalı.";
  const son = k.grupGecmisi[k.grupGecmisi.length - 1];
  if (k.grupGecmisi.length !== eski.grupGecmisi.length + 1 || JSON.stringify(k.grupGecmisi.slice(0, -1)) !== JSON.stringify(eski.grupGecmisi) || son?.grupId !== g.id)
    return "Grup değişikliği grup geçmişine eklenmeli; geçmiş silinemez.";
  return null;
}

const KILITLI_ALANLAR = ["ogrenciId", "sezonId", "sozlesmeNo", "tarih", "iceAktarmaId"] as const;

/**
 * Bir kayıt satırının yazılması (yeni kayıt, grup değişikliği, şube nakli, dondurma, iptal).
 * - sonraki: değişiklik uygulanmış veri (yeni öğrenci + kaydı aynı pakette gelir)
 * - rol: kapasite aşımı onayı için; genel: aktif olmayan sezona kayıt (sezon geçişi) için
 * Şube kapsamı (nakilde eski ve yeni şube) sunucuda yazmaDenetle() içinde denetlenir.
 */
export function kayitYazmaEngeli(
  k: Kayit,
  eski: Kayit | undefined,
  sonraki: Pick<Db, "kayitlar" | "gruplar" | "subeler" | "sezonlar" | "ogrenciler">,
  secenek: { rol: Rol },
): Hata {
  if (!k || typeof k !== "object" || typeof k.ogrenciId !== "string") return "Kayıt bilgisi geçersiz.";
  if (!Array.isArray(k.grupGecmisi) || !Array.isArray(k.ekHizmetler) || !Array.isArray(k.indirimler)) return "Kayıt bilgisi geçersiz.";
  const gecis = kayitDurumGecisEngeli(eski?.durum ?? null, k.durum);
  if (gecis) return gecis;
  const genel = secenek.rol === "genel-yonetici";

  if (!eski) {
    if (!sonraki.ogrenciler.some((o) => o.id === k.ogrenciId)) return "Kaydın öğrencisi bulunamadı.";
    const no = sozlesmeNoEngeli(k, sonraki);
    if (no) return no;
    const atama = grupAtamaEngeli(k, sonraki);
    if (atama) return atama;
    const sezon = sonraki.sezonlar.find((z) => z.id === k.sezonId)!;
    if (!sezon.aktif && !genel) return "Kayıt yalnızca aktif sezona yapılabilir.";
    if (sonraki.kayitlar.some((x) => x.id !== k.id && x.ogrenciId === k.ogrenciId && x.sezonId === k.sezonId && x.durum !== "iptal"))
      return "Öğrencinin bu sezonda zaten bir kaydı var; ek hizmetler mevcut kayda eklenir.";
  } else {
    if (eski.durum === "iptal" && !ayni(eski, k)) return "İptal edilen kayıt değiştirilemez.";
    if (eski.durum === "mezun") {
      // Tek istisna: KVKK anonimleştirmesinde (Bölüm 14) mezun kayıt da iptal edilir
      const anonim = sonraki.ogrenciler.find((o) => o.id === k.ogrenciId);
      if (!(k.durum === "iptal" && anonim && ogrenciAnonimMi(anonim) && ayni({ ...eski, durum: "iptal" }, k))) return "Mezun kayıt değiştirilemez.";
    }
    if (k.durum === "mezun" && eski.durum !== "mezun") {
      if (!genel) return "Mezuniyet sezon geçişinde genel yönetici tarafından işaretlenir.";
      const g = sonraki.gruplar.find((x) => x.id === k.grupId);
      if (!g || g.seviye < EN_YUKSEK_SEVIYE) return `Yalnızca ${EN_YUKSEK_SEVIYE}. sınıf kaydı mezun olur.`;
      if (!ayni({ ...eski, durum: "mezun" }, k)) return "Mezun işaretlenirken kaydın diğer bilgileri değiştirilemez.";
    }
    for (const a of KILITLI_ALANLAR) if (eski[a] !== k[a]) return "Kaydın öğrencisi, sezonu, sözleşme numarası ve tarihi değiştirilemez.";
    if (eski.kvkkOnay && JSON.stringify(eski.kvkkOnay) !== JSON.stringify(k.kvkkOnay)) return "Alınmış KVKK onayı değiştirilemez.";
    const yerDegisti = eski.grupId !== k.grupId || eski.subeId !== k.subeId;
    if (yerDegisti) {
      if (k.durum === "iptal") return "İptal edilirken grup veya şube değiştirilemez.";
      const atama = grupAtamaEngeli(k, sonraki);
      if (atama) return atama;
      const son = k.grupGecmisi[k.grupGecmisi.length - 1];
      if (
        k.grupGecmisi.length !== eski.grupGecmisi.length + 1 ||
        JSON.stringify(k.grupGecmisi.slice(0, -1)) !== JSON.stringify(eski.grupGecmisi) ||
        son?.grupId !== k.grupId ||
        !isoTarihMi(son?.tarih)
      )
        return "Grup değişikliği grup geçmişine eklenmeli; geçmiş silinemez.";
    } else if (JSON.stringify(eski.grupGecmisi) !== JSON.stringify(k.grupGecmisi)) return "Grup geçmişi silinemez veya değiştirilemez.";
  }

  // Kapasite: gruba yeni giren aktif öğrenci (yeni kayıt, grup değişikliği/nakil, dondurmadan dönüş)
  const giriyor = k.durum === "aktif" && (!eski || eski.grupId !== k.grupId || eski.durum !== "aktif");
  if (giriyor && !kapasiteOnaylayabilir(secenek.rol)) {
    const g = sonraki.gruplar.find((x) => x.id === k.grupId);
    if (g && grupAktifSayisi(sonraki, g.id) > g.kapasite)
      return "Grubun kontenjanı dolu; kapasite aşımını yalnızca sekreter, şube müdürü veya genel yönetici onaylayabilir.";
  }
  return null;
}

/* ---------- Öğrenci ve veli satırı ---------- */
/**
 * Öğrenci kartının yazılması.
 * - yeni kart aynı pakette bir kayıtla gelmeli (kayıtsız öğrenci hiçbir şubeye ait olmaz)
 * - notlar yalnızca başa eklenir
 * - durum değişirse kayıtlarıyla uyumlu olmalı (ogrenciDurumu): ayrılan / mezun öğrenci yalnızca yeni kayıtla aktifleşir
 * - mükerrer öğrenci (aynı ad + veli telefonu) kurum genelinde engellenir
 * - KVKK anonimleştirmesi (Bölüm 14) yalnızca 14 yetkisiyle; anonim kart değiştirilemez
 */
export function ogrenciYazmaEngeli(
  o: Ogrenci,
  eski: Ogrenci | undefined,
  sonraki: Pick<Db, "ogrenciler" | "veliler" | "kayitlar">,
  secenek: { kvkkYetkisi: boolean; bugun: string },
): Hata {
  if (eski && ogrenciAnonimMi(eski)) return "Anonimleştirilmiş öğrenci değiştirilemez.";
  if (eski && ogrenciAnonimMi(o)) {
    if (!secenek.kvkkYetkisi) return "Öğrenci anonimleştirme yalnızca KVKK (14) yetkisiyle yapılabilir.";
    if (o.durum !== "ayrildi") return "Anonimleştirilen öğrenci 'ayrıldı' durumunda olmalı.";
    if (sonraki.kayitlar.some((k) => k.ogrenciId === o.id && k.durum !== "iptal")) return "Anonimleştirilen öğrencinin kayıtları iptal edilmeli.";
    return null;
  }
  const alan = ogrenciDogrula(o, secenek.bugun);
  if (alan) return alan;
  if (o.veliIds.some((id) => !sonraki.veliler.some((v) => v.id === id))) return "Öğrencinin velisi bulunamadı.";
  const kayitlar = sonraki.kayitlar.filter((k) => k.ogrenciId === o.id);
  if (!eski) {
    if (!kayitlar.length) return "Öğrenci kartı bir kayıtla birlikte oluşturulmalı (kayıt sihirbazı veya Excel içe aktarma).";
    if (o.durum !== "aktif") return "Yeni öğrenci aktif durumda açılır.";
  } else {
    if (!notlarBasaEklemeMi(eski.notlar, o.notlar)) return "Notlar silinemez veya değiştirilemez; yalnızca yeni not eklenir.";
  }
  if (!eski || eski.durum !== o.durum) {
    const hesap = ogrenciDurumu(o.id, kayitlar);
    if (o.durum !== hesap)
      return o.durum === "aktif"
        ? "Ayrılan / mezun öğrenci yalnızca yeni bir kayıtla yeniden aktif olur (öğrenci kartı → Yeniden kayıt)."
        : hesap === "aktif"
          ? "Süren kaydı olan öğrenci 'ayrıldı' / 'mezun' yapılamaz."
          : "Öğrencinin durumu kayıtlarıyla uyumlu olmalı.";
  }
  const kimlikDegisti = !eski || eski.ad !== o.ad || eski.soyad !== o.soyad || JSON.stringify(eski.veliIds) !== JSON.stringify(o.veliIds);
  if (kimlikDegisti) {
    const tel = o.veliIds.map((id) => sonraki.veliler.find((v) => v.id === id)?.telefon ?? "");
    const m = mukerrerOgrenci(o, tel, sonraki);
    if (m) return "Bu ad ve veli telefonuyla kayıtlı bir öğrenci var. Öğrenci kurum genelinde tektir; başka şubedeyse şube nakli yapılmalı.";
  }
  return null;
}

/**
 * Veli satırının yazılması: alan kuralları ve telefon benzersizliği (veli portalına telefonla girilir).
 * Yeni velinin telefonu kayıtlı bir veliye aitse sunucu yeni veliyi mevcut veliyle birleştirir (veliBirlestirmeleri),
 * bu yüzden bu denetim yalnızca var olan velinin telefon değişikliğine uygulanır.
 */
export function veliYazmaEngeli(v: Veli, eski: Veli | undefined, sonraki: Pick<Db, "veliler">, secenek: { kvkkYetkisi: boolean }): Hata {
  if (eski && veliAnonimMi(eski)) return "Anonimleştirilmiş veli değiştirilemez.";
  if (eski && veliAnonimMi(v)) return secenek.kvkkYetkisi ? null : "Veli anonimleştirme yalnızca KVKK (14) yetkisiyle yapılabilir.";
  const alan = veliDogrula(v);
  if (alan) return alan;
  if (!eski || telefonNormalize(eski.telefon) !== telefonNormalize(v.telefon)) {
    const sahip = telefonSahibiVeli(v.telefon, sonraki.veliler, v.id);
    if (sahip) return "Bu telefon numarası başka bir veliye kayıtlı.";
  }
  return null;
}

/**
 * Aynı pakette eklenen yeni velilerden telefonu kayıtlı bir veliye ait olanlar: yeniId → mevcut veli id.
 * Ekran yalnızca kendi şubesindeki velileri gördüğü için başka şubedeki kardeşin velisini bulamayabilir;
 * öğrenci ve veli kurum genelinde tek olduğundan sunucu yeni veliyi mevcut veliye bağlar.
 * Aynı pakette aynı telefonla iki yeni veli varsa ilki esas alınır.
 */
export function veliBirlestirmeleri(yeniVeliler: Veli[], mevcutVeliler: Veli[]): Map<string, string> {
  const m = new Map<string, string>();
  const ilk = new Map<string, string>();
  for (const v of yeniVeliler) {
    const tel = telefonNormalize(v.telefon);
    if (!tel) continue;
    const sahip = telefonSahibiVeli(tel, mevcutVeliler);
    if (sahip) m.set(v.id, sahip.id);
    else if (ilk.has(tel)) m.set(v.id, ilk.get(tel)!);
    else ilk.set(tel, v.id);
  }
  return m;
}

/* ---------- Kayıt iptali → aday yeniden açılır (karar 2026-11-07) ---------- */
/** Öğrenciye bağlı, kayda dönüşmüş aday */
export const bagliAday = (ogrenciId: string, adaylar: Aday[]) => adaylar.find((a) => a.durum === "kayit" && a.ogrenciId === ogrenciId);

/**
 * Bu pakette öğrencinin bir kaydı iptal edildi ve iptal olmayan kaydı kalmadı mı?
 * (Adayın yeniden açılması yalnızca bu durumda ve yalnızca bu pakette izinlidir.)
 */
export function iptalPaketiMi(
  ogrenciId: string,
  oncekiKayitlar: Pick<Kayit, "id" | "ogrenciId" | "durum">[],
  yazilanKayitlar: Pick<Kayit, "id" | "ogrenciId" | "durum">[],
  sonrakiKayitlar: Pick<Kayit, "ogrenciId" | "durum">[],
): boolean {
  const iptalEdildi = yazilanKayitlar.some(
    (k) => k.ogrenciId === ogrenciId && k.durum === "iptal" && oncekiKayitlar.find((x) => x.id === k.id)?.durum !== "iptal",
  );
  return iptalEdildi && ogrenciDurumu(ogrenciId, sonrakiKayitlar) !== "aktif";
}

/** Kayıt iptalinde adayın yeni hali: açık duruma döner, öğrenci bağı kalkar, sonraki aksiyon bugün, not eklenir */
export function adayYenidenAc(a: Aday, not: Aday["notlar"][number], bugun: string): Aday {
  const { ogrenciId: _o, ...temel } = a;
  void _o;
  return { ...temel, durum: YENIDEN_ACILAN_DURUM, sonrakiAksiyon: bugun, notlar: [...a.notlar, not] };
}

/**
 * Kayıt iptaliyle aynı pakette adayın yeniden açılması (Bölüm 03'ün "kayıt geri alınamaz" kuralının tek istisnası).
 * Yalnızca durum, öğrenci bağı, sonraki aksiyon ve sona eklenen not değişebilir.
 */
export function adayYenidenAcmaEngeli(a: Aday, eski: Aday): Hata {
  if (eski.durum !== "kayit") return "Yalnızca kayda dönüşmüş aday yeniden açılır.";
  if (a.durum !== YENIDEN_ACILAN_DURUM) return "Kaydı iptal edilen öğrencinin adayı “Görüşüldü” durumuna döner.";
  if (a.ogrenciId !== undefined) return "Yeniden açılan adayın öğrenci bağlantısı kaldırılmalı.";
  if (a.sonrakiAksiyon !== null && !isoTarihMi(a.sonrakiAksiyon)) return "Sonraki aksiyon tarihi geçersiz.";
  const diger = (x: Aday) => ({ ...x, durum: "", ogrenciId: null, sonrakiAksiyon: null, notlar: [] });
  if (!ayni(diger(a), diger(eski))) return "Aday yeniden açılırken diğer bilgileri değiştirilemez.";
  if (!notlarEklemeMi(eski.notlar, a.notlar)) return "Görüşme notları silinemez veya değiştirilemez; yalnızca yeni not eklenir.";
  return null;
}

/* ---------- Ödeme planı girdisi (Bölüm 05 modeli değişmeden, bariz hatalar) ---------- */
export function odemePlaniEngeli(net: number, plan: { pesinat: number; taksit: number; ilkVade: string }): Hata {
  if (!Number.isFinite(plan.pesinat) || plan.pesinat < 0) return "Peşinat 0 veya daha büyük olmalı.";
  if (plan.pesinat > net) return "Peşinat net tutardan büyük olamaz.";
  if (!Number.isInteger(plan.taksit) || plan.taksit < 0 || plan.taksit > 12) return "Taksit sayısı 0–12 arası tam sayı olmalı.";
  if (plan.taksit === 0 && net > 0 && plan.pesinat < net) return "Taksit yoksa peşinat net tutara eşit olmalı.";
  if (net > 0 && !isoTarihMi(plan.ilkVade)) return "İlk vade tarihi seçin.";
  return null;
}
