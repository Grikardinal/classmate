/**
 * Bölüm 03 · Ön kayıt (aday öğrenci) — saf iş kuralları.
 * Ekran (anında geri bildirim) ve sunucu (server/politika.ts · onKayitDenetle, son söz) aynı fonksiyonları kullanır.
 * Bu yüzden yalnızca göreli içe aktarma ve tip içe aktarması yapılır. Testler: kurallar.test.ts
 */
import type { Aday, AdayDurum, Db, Personel } from "../../data/model";
import { normalAd, telefonNormalize } from "../../lib/kurallar";

/** Doğrulama sonucu: null = geçerli, metin = kullanıcıya gösterilecek ilk hata */
export type Hata = string | null;

export const ADAY_DURUMLARI: { key: AdayDurum; ad: string; renk: "default" | "secondary" | "success" | "warning" | "danger" | "outline" }[] = [
  { key: "yeni", ad: "Yeni aday", renk: "default" },
  { key: "gorusuldu", ad: "Görüşüldü", renk: "outline" },
  { key: "deneme", ad: "Deneme dersi", renk: "warning" },
  { key: "dusunuyor", ad: "Düşünüyor", renk: "secondary" },
  { key: "kayit", ad: "Kayıt oldu", renk: "success" },
  { key: "vazgecti", ad: "Vazgeçti", renk: "danger" },
];
export const KAYNAKLAR = ["Tavsiye", "Instagram", "Google", "Tabela", "Eski öğrenci", "Web formu", "Diğer"];
export const VAZGECME_NEDENLERI = ["Fiyat", "Saat uymadı", "Başka kurum", "Ulaşım", "Diğer"];
export const ADAY_SEVIYELERI = [3, 4, 5, 6, 7, 8] as const;
/** Ad alanları ve not metni için üst sınır (yanlış yapıştırmayı yakalamak için) */
export const AD_EN_FAZLA = 80;
export const NOT_EN_FAZLA = 2000;
/** Anonimleştirilmiş adayın telefon alanı (Bölüm 14 · KVKK saklama süresi) */
export const ANONIM_TELEFON = "*** *** ** **";

export const durumBilgisi = (k: AdayDurum) => ADAY_DURUMLARI.find((x) => x.key === k) ?? ADAY_DURUMLARI[0];

/** Açık aday: henüz sonuçlanmamış (kayıt olmamış, vazgeçmemiş) */
export const acikMi = (a: Pick<Aday, "durum">) => a.durum !== "kayit" && a.durum !== "vazgecti";

/** KVKK saklama süresi dolduğu için anonimleştirilmiş aday (Bölüm 14) — artık değiştirilemez */
export const anonimMi = (a: Pick<Aday, "veliTelefon">) => a.veliTelefon === ANONIM_TELEFON;

/** Bugün aranacaklar: açık ve sonraki aksiyon tarihi bugün veya geçmiş */
export const bugunAranacakMi = (a: Pick<Aday, "durum" | "sonrakiAksiyon">, bugun: string) => acikMi(a) && !!a.sonrakiAksiyon && a.sonrakiAksiyon <= bugun;

const isoTarihMi = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s + "T00:00:00").getTime());
const bos = (s: unknown) => typeof s !== "string" || s.trim() === "";

/**
 * Durum geçişi kuralı:
 * - "kayit" yalnızca kesin kayıt sihirbazıyla (öğrenci kartı oluşturularak) verilir; elle/sürükleyerek seçilemez.
 * - Kayda dönüşmüş aday geri alınamaz (öğrenci kaydı iptali Bölüm 04'ün işidir).
 * - Diğer açık durumlar ve "vazgecti" arasında serbest geçiş (vazgeçen aday geri dönebilir).
 */
export function durumGecisEngeli(eski: AdayDurum | null, yeni: AdayDurum, kesinKayit = false): Hata {
  if (!ADAY_DURUMLARI.some((d) => d.key === yeni)) return "Geçersiz aday durumu.";
  if (eski === "kayit" && yeni !== "kayit") return "Kayda dönüşmüş aday geri alınamaz.";
  if (yeni === "kayit" && eski !== "kayit" && !kesinKayit) return "Kesin kayıt için “Kesin kayda çevir” düğmesini kullanın.";
  return null;
}

/** Telefonla girilen adın temizlenmiş hali */
export const adTemizle = (s: string) => String(s ?? "").replace(/\s+/g, " ").trim();

/** Alan kuralları (yeni veya düzenlenen aday). Anonim aday bu denetime girmez. */
export function adayDogrula(a: Aday): Hata {
  if (!a || typeof a !== "object") return "Aday bilgisi geçersiz.";
  if (bos(a.veliAd)) return "Veli adı zorunlu.";
  if (adTemizle(a.veliAd).length < 2) return "Veli adı en az 2 karakter olmalı.";
  if (a.veliAd.length > AD_EN_FAZLA || String(a.ogrenciAd ?? "").length > AD_EN_FAZLA) return `Ad en fazla ${AD_EN_FAZLA} karakter olabilir.`;
  if (!telefonNormalize(a.veliTelefon)) return "Geçerli bir veli telefonu girin (05xx xxx xx xx).";
  if (typeof a.ogrenciAd !== "string") return "Öğrenci adı geçersiz.";
  if (!ADAY_SEVIYELERI.includes(a.seviye as (typeof ADAY_SEVIYELERI)[number])) return "Sınıf 3–8 arasında olmalı.";
  if (typeof a.okul !== "string" || a.okul.length > 120) return "Okul adı geçersiz.";
  if (bos(a.kaynak)) return "Kaynak seçin.";
  if (!ADAY_DURUMLARI.some((d) => d.key === a.durum)) return "Geçersiz aday durumu.";
  if (a.sonrakiAksiyon !== null && !isoTarihMi(a.sonrakiAksiyon)) return "Sonraki aksiyon tarihi geçersiz.";
  if (a.denemeTarihi !== null && !isoTarihMi(a.denemeTarihi)) return "Deneme dersi tarihi geçersiz.";
  if (a.durum === "vazgecti" && bos(a.vazgecmeNedeni)) return "Vazgeçme nedeni seçin.";
  if (a.durum !== "vazgecti" && a.vazgecmeNedeni !== null) return "Vazgeçme nedeni yalnızca vazgeçen adayda tutulur.";
  if (a.teklif !== null && (typeof a.teklif !== "number" || !Number.isFinite(a.teklif) || a.teklif < 0)) return "Fiyat teklifi 0 veya daha büyük bir tutar olmalı.";
  if (typeof a.rizaVar !== "boolean") return "KVKK açık rıza bilgisi geçersiz.";
  if (!Array.isArray(a.notlar)) return "Görüşme notları geçersiz.";
  for (const n of a.notlar)
    if (!n || typeof n.metin !== "string" || bos(n.metin) || n.metin.length > NOT_EN_FAZLA || typeof n.yazar !== "string" || typeof n.tarih !== "string")
      return `Görüşme notu boş olamaz ve en fazla ${NOT_EN_FAZLA} karakter olabilir.`;
  if (a.durum === "kayit" && !a.ogrenciId) return "Kayıt olan aday bir öğrenci kartına bağlı olmalı.";
  return null;
}

/** Görüşme notları zaman çizelgesidir: eski notlar silinemez/değiştirilemez, yalnızca sona eklenir. */
export function notlarEklemeMi(eski: Aday["notlar"], yeni: Aday["notlar"]): boolean {
  if (!Array.isArray(yeni) || yeni.length < eski.length) return false;
  return eski.every((n, i) => JSON.stringify(n) === JSON.stringify(yeni[i]));
}

/** Adayı takip edebilecek personel: şubede görevli, aktif, öğretmen olmayan */
export function sorumluAdaylari(personel: Personel[], subeId: string): Personel[] {
  return personel.filter((p) => p.aktif && p.subeIds.includes(subeId) && p.gorev !== "ogretmen");
}

/** Yeni aday için varsayılan sorumlu: tercihen o şubenin sekreteri, yoksa şube müdürü, yoksa ilk uygun personel */
export function varsayilanSorumlu(personel: Personel[], subeId: string, tercih?: string): string | null {
  const l = sorumluAdaylari(personel, subeId);
  if (tercih && l.some((p) => p.id === tercih)) return tercih;
  return (l.find((p) => p.gorev === "sekreter") ?? l.find((p) => p.gorev === "sube-muduru") ?? l[0])?.id ?? null;
}

/**
 * Yinelenen açık aday: aynı veli telefonu (normalize edilerek) ve aynı öğrenci adı (veya ikisinden biri adsız).
 * Kayda dönüşmüş, vazgeçmiş ve anonimleştirilmiş adaylar engel değildir.
 */
export function yinelenenAday(a: Pick<Aday, "id" | "veliTelefon" | "ogrenciAd">, adaylar: Aday[]): Aday | null {
  const tel = telefonNormalize(a.veliTelefon);
  if (!tel) return null;
  const ad = normalAd(String(a.ogrenciAd ?? "").replace("—", ""));
  return (
    adaylar.find((x) => {
      if (x.id === a.id || !acikMi(x) || anonimMi(x) || telefonNormalize(x.veliTelefon) !== tel) return false;
      const xAd = normalAd(String(x.ogrenciAd ?? "").replace("—", ""));
      return !ad || !xAd || xAd === ad;
    }) ?? null
  );
}

/** Aranan metin: büyük/küçük harf ve boşluk farkı yok (telefon "0532 100" veya "0532100" ile bulunur) */
export function adayAramaUyar(a: Pick<Aday, "veliAd" | "ogrenciAd" | "veliTelefon">, ara: string): boolean {
  const sade = (s: string) => s.toLocaleLowerCase("tr-TR").replace(/\s/g, "");
  const q = sade(ara);
  return !q || sade(`${a.veliAd}${a.ogrenciAd}${a.veliTelefon}`).includes(q);
}

/** Kaynağa / şubeye göre dönüşüm: toplam aday ve kayıt olan sayısı */
export function donusumGrupla(adaylar: Aday[], anahtar: (a: Aday) => string): [string, { toplam: number; kayit: number }][] {
  const m = new Map<string, { toplam: number; kayit: number }>();
  for (const a of adaylar) {
    const k = anahtar(a);
    const v = m.get(k) ?? { toplam: 0, kayit: 0 };
    v.toplam++;
    if (a.durum === "kayit") v.kayit++;
    m.set(k, v);
  }
  return [...m.entries()].sort((a, b) => b[1].toplam - a[1].toplam);
}

/** Dönüşüm oranı (%): sonuçlanan (kayıt + vazgeçti) adaylar içinde kayıt olanlar */
export function donusumOrani(adaylar: Pick<Aday, "durum">[]): number {
  const sonuclanan = adaylar.filter((a) => !acikMi(a)).length;
  return sonuclanan ? Math.round((adaylar.filter((a) => a.durum === "kayit").length / sonuclanan) * 100) : 0;
}

/** Kesin kayda çevrilebilir mi (ekran ve Bölüm 04 sihirbazı) */
export function kesinKayitEngeli(a: Aday | undefined): Hata {
  if (!a) return "Aday bulunamadı.";
  if (a.durum === "kayit") return "Bu aday zaten kesin kayda çevrildi.";
  if (anonimMi(a)) return "Anonimleştirilmiş aday kayda çevrilemez.";
  return null;
}

/**
 * Sunucu ve ekran için tam denetim: bir aday satırının yazılması.
 * - eski: önceki hali (yoksa yeni aday)
 * - sonraki: değişiklik uygulanmış veri (kesin kayıtta öğrenci aynı pakette gelir)
 * - modulAcik: "onKayit" modülü açık mı
 * - onKayitYetkisi: aktörün Bölüm 03 yetkisi (yoksa yalnızca Bölüm 04 kesin kayıt dönüşümü yapılabilir)
 * - kvkkYetkisi: aktörün Bölüm 14 yetkisi (vazgeçen adayın anonimleştirilmesi)
 * - kapsam: aktörün şube kapsamı (genel yönetici için verilmez). Kapsam dışındaki şubeye devir adayDevirEngeli ile denetlenir.
 * - istemci: ekrandan çağrı. Ekran hedef şubenin tüm personelini göremeyebilir; kapsam dışına devirde sorumluyu sunucu atar ve denetler.
 */
export function adayYazmaEngeli(
  a: Aday,
  eski: Aday | undefined,
  sonraki: Pick<Db, "subeler" | "personel" | "ogrenciler" | "adaylar">,
  secenek: { modulAcik: boolean; onKayitYetkisi: boolean; kvkkYetkisi?: boolean; kapsam?: string[]; istemci?: boolean },
): Hata {
  // KVKK anonimleştirmesi (Bölüm 14) modül kapalıyken de yapılabilir
  if (eski && anonimMi(a)) {
    if (!secenek.kvkkYetkisi) return "Aday anonimleştirme yalnızca KVKK (14) yetkisiyle yapılabilir.";
    if (anonimMi(eski)) return "Anonimleştirilmiş aday değiştirilemez.";
    if (eski.durum !== "vazgecti" || a.durum !== "vazgecti") return "Yalnızca vazgeçen aday anonimleştirilebilir.";
    if (a.notlar.length) return "Anonimleştirilen adayın görüşme notları silinmeli.";
    const kisiselHaric = (x: Aday) => JSON.stringify({ ...x, veliAd: "", veliTelefon: "", ogrenciAd: "", notlar: [] });
    if (kisiselHaric(eski) !== kisiselHaric(a)) return "Anonimleştirmede yalnızca kişisel alanlar değiştirilebilir.";
    return null;
  }
  if (!eski && anonimMi(a)) return "Geçerli bir veli telefonu girin (05xx xxx xx xx).";
  if (!secenek.modulAcik) return "Ön kayıt modülü kapalı.";
  if (eski && anonimMi(eski)) return "Anonimleştirilmiş aday değiştirilemez.";
  // Kayda dönüşmüş aday kilitlidir (eski verideki öğrenci bağı olmayan kayıtlar da)
  if (eski?.durum === "kayit") {
    if (a.durum !== "kayit") return "Kayda dönüşmüş aday geri alınamaz.";
    if (a.subeId !== eski.subeId) return "Kayda dönüşmüş aday devredilemez.";
    if (JSON.stringify({ ...eski, notlar: [] }) !== JSON.stringify({ ...a, notlar: [] })) return "Kayda dönüşmüş adayın bilgileri değiştirilemez.";
    if (!secenek.onKayitYetkisi) return "Ön kayıt (aday) verisini değiştirme yetkiniz yok.";
    return notlarEklemeMi(eski.notlar, a.notlar) ? null : "Görüşme notları silinemez veya değiştirilemez; yalnızca yeni not eklenir.";
  }
  const kesinKayit = a.durum === "kayit";
  if (!secenek.onKayitYetkisi && !kesinKayit) return "Ön kayıt (aday) verisini değiştirme yetkiniz yok.";
  const alan = adayDogrula(a);
  if (alan) return alan;
  const gecis = durumGecisEngeli(eski?.durum ?? null, a.durum, kesinKayit && !!a.ogrenciId);
  if (gecis) return gecis;
  if (!eski && a.durum === "kayit") return "Yeni aday doğrudan kayıt durumunda eklenemez.";
  if (eski && !notlarEklemeMi(eski.notlar, a.notlar)) return "Görüşme notları silinemez veya değiştirilemez; yalnızca yeni not eklenir.";
  if (kesinKayit) {
    const o = sonraki.ogrenciler.find((x) => x.id === a.ogrenciId);
    if (!o) return "Kesin kayıt için öğrenci kartı bulunamadı.";
    if (sonraki.adaylar.some((x) => x.id !== a.id && x.ogrenciId === a.ogrenciId)) return "Bu öğrenci kartı başka bir adaya bağlı.";
  } else if (a.ogrenciId !== eski?.ogrenciId) return "Adayın öğrenci bağlantısı yalnızca kesin kayıtla kurulur.";
  // Kapsam dışındaki şubeye devir (karar 2026-11-07): yalnızca şube + sorumlu değişir, sorumlu hedef şubeden atanır
  const disariDevir = !!eski && eski.subeId !== a.subeId && !!secenek.kapsam && !secenek.kapsam.includes(a.subeId);
  if (eski && disariDevir) {
    const devir = adayDevirEngeli(a, eski, sonraki, !secenek.istemci);
    if (devir) return devir;
  }
  // Şube: yeni adayda veya devirde aktif şube olmalı
  if (!eski || eski.subeId !== a.subeId) {
    const s = sonraki.subeler.find((x) => x.id === a.subeId);
    if (!s) return "Adayın şubesi bulunamadı.";
    if (!s.aktif) return "Pasif şubeye aday eklenemez / devredilemez.";
  }
  // Sorumlu: yeni adayda, devirde veya sorumlu değişince şubede görevli aktif personel olmalı
  if ((!eski || eski.subeId !== a.subeId || eski.sorumluId !== a.sorumluId) && !(disariDevir && secenek.istemci)) {
    if (!sorumluAdaylari(sonraki.personel, a.subeId).some((p) => p.id === a.sorumluId))
      return "Sorumlu personel adayın şubesinde görevli aktif bir personel (öğretmen dışı) olmalı.";
  }
  // Yinelenen açık aday: yeni adayda, telefon/öğrenci adı değişince veya sonuçlanmış aday yeniden açılınca
  const kimlikDegisti = !eski || eski.veliTelefon !== a.veliTelefon || eski.ogrenciAd !== a.ogrenciAd || (!acikMi(eski) && acikMi(a));
  if (kimlikDegisti && acikMi(a)) {
    const y = yinelenenAday(a, sonraki.adaylar);
    if (y) return `Bu veli telefonuyla açık bir aday zaten var: ${y.veliAd} (${y.ogrenciAd}).`;
  }
  return null;
}

/** Kapsam dışına devirde değişmesine izin verilen alanlar dışındaki her şey */
const devirDisi = (x: Aday) => JSON.stringify({ ...x, subeId: "", sorumluId: "", notlar: [] });

/**
 * Kapsam dışındaki şubeye devir (karar 2026-11-07): kapsamı sınırlı kullanıcı kendi şubesindeki adayı
 * kapsamı dışındaki aktif bir şubeye devredebilir; devirden sonra aday onun kapsamından çıkar.
 * En güvenli yol: aynı pakette adayın başka alanı değişmez (yalnızca şube, sorumlu ve sona eklenen not),
 * sorumlu hedef şubeden varsayilanSorumlu() ile atanır, kayda dönmüş / anonim aday devredilemez.
 * Eski şubede yetkili olma şartı sunucuda (yazmaDenetle · eski halin kapsamı) denetlenir.
 */
export function adayDevirEngeli(a: Aday, eski: Aday, sonraki: Pick<Db, "subeler" | "personel">, sorumluDenetle = true): Hata {
  if (eski.durum === "kayit") return "Kayda dönüşmüş aday devredilemez.";
  if (anonimMi(eski)) return "Anonimleştirilmiş aday devredilemez.";
  const hedef = sonraki.subeler.find((x) => x.id === a.subeId);
  if (!hedef) return "Adayın şubesi bulunamadı.";
  if (!hedef.aktif) return "Pasif şubeye aday eklenemez / devredilemez.";
  if (devirDisi(a) !== devirDisi(eski))
    return "Başka şubeye devirde adayın diğer bilgileri değiştirilemez; önce değişiklikleri kaydedip sonra devredin.";
  if (!notlarEklemeMi(eski.notlar, a.notlar)) return "Görüşme notları silinemez veya değiştirilemez; yalnızca yeni not eklenir.";
  if (!sorumluDenetle) return null;
  const sorumlu = varsayilanSorumlu(sonraki.personel, a.subeId);
  if (!sorumlu) return "Hedef şubede adayı takip edecek aktif personel yok.";
  if (a.sorumluId !== sorumlu) return "Devirde sorumlu, hedef şubenin varsayılan sorumlusu olmalı.";
  return null;
}
