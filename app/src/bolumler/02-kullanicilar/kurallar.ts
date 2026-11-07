/**
 * Bölüm 02 · Kullanıcılar, roller ve yetkiler — saf iş kuralları.
 * Arayüzden ve sunucudan bağımsızdır: ekran (anında geri bildirim) ve sunucu (server/politika.ts,
 * server/uygulama.ts, server/kimlik.ts — son söz) aynı fonksiyonları kullanır.
 * Bu yüzden yalnızca göreli içe aktarma ve tip içe aktarması yapılır (`@/` yok).
 * Testler: kurallar.test.ts, sunucu.test.ts
 */
import type { Kullanici, Personel, Rol } from "../../data/model";
import { epostaGecerli } from "../../lib/kurallar";

/** Doğrulama sonucu: null = geçerli, metin = kullanıcıya gösterilecek ilk hata */
export type Hata = string | null;

export const ROLLER: Rol[] = ["genel-yonetici", "sube-muduru", "sekreter", "ogretmen"];

/** Bölüm kodları (rol → bölüm yetki tablosunun satırları) */
export const BOLUM_KODLARI = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14"] as const;

/**
 * Rol seviyesi: yüksek olan daha geniş erişime sahiptir.
 * Genel yönetici olmayan bir kullanıcı kendinden yüksek seviyeli rol atayamaz ve
 * kendinden yüksek seviyeli bir hesabı düzenleyemez / parolasını sıfırlayamaz.
 */
export const ROL_SEVIYESI: Record<Rol, number> = { "genel-yonetici": 4, "sube-muduru": 3, sekreter: 2, ogretmen: 1 };

export const rolGecerli = (r: unknown): r is Rol => typeof r === "string" && (ROLLER as string[]).includes(r);

/** Rolün bölüme erişimi var mı (sunucu ve ekran aynı kuralı kullanır: yalnızca `true` yetki verir) */
export function bolumYetkisi(rolYetkileri: Partial<Record<Rol, Record<string, boolean>>> | null | undefined, rol: Rol, kod: string): boolean {
  return rolYetkileri?.[rol]?.[kod] === true;
}

/* ---------- E-posta ---------- */

/**
 * Giriş e-postasını karşılaştırma/saklama biçimine çevirir: boşluk atılır, küçük harfe çevrilir.
 * Türkçe klavyeden gelen "I", "İ" ve "ı" harfleri "i" sayılır; böylece "Ismail@…", "İsmail@…" ve
 * "ismail@…" aynı hesaptır (toLocaleLowerCase("tr") "I" harfini "ı" yaptığı için girişte eşleşmiyordu).
 */
export function epostaNormalize(e: unknown): string {
  return String(e ?? "")
    .trim()
    .replace(/[İIı]/g, "i")
    .toLowerCase();
}

export const ayniEposta = (a: string, b: string) => epostaNormalize(a) === epostaNormalize(b);

/** Girilen e-posta geçerli ve (kendisi dışındaki) kullanıcılar arasında benzersiz mi */
export function epostaDogrula(eposta: string, kullanicilar: Pick<Kullanici, "id" | "eposta">[], kendiId?: string): Hata {
  const e = epostaNormalize(eposta);
  if (!e) return "E-posta gerekli.";
  if (e.length > 120 || !epostaGecerli(e)) return "Geçerli bir e-posta girin.";
  if (kullanicilar.some((k) => k.id !== kendiId && ayniEposta(k.eposta, e))) return "Bu e-postayla kayıtlı başka bir kullanıcı var.";
  return null;
}

/* ---------- Parola ---------- */

export const PAROLA_EN_AZ = 8;
export const PAROLA_EN_FAZLA = 128;

/** Parola kuralı: 8–128 karakter, en az bir harf ve bir rakam */
export function parolaKurali(p: unknown): Hata {
  if (typeof p !== "string" || p.length < PAROLA_EN_AZ) return `Parola en az ${PAROLA_EN_AZ} karakter olmalı.`;
  if (p.length > PAROLA_EN_FAZLA) return `Parola en fazla ${PAROLA_EN_FAZLA} karakter olabilir.`;
  if (!/\p{L}/u.test(p)) return "Parola en az bir harf içermeli.";
  if (!/\d/.test(p)) return "Parola en az bir rakam içermeli.";
  return null;
}

/** Parola değiştirme formu: kural + tekrar eşleşmesi + eskisinden farklı olma */
export function parolaDegisimDogrula(eski: string, yeni: string, tekrar?: string): Hata {
  const h = parolaKurali(yeni);
  if (h) return h;
  if (tekrar !== undefined && yeni !== tekrar) return "Parolalar eşleşmiyor.";
  if (eski && yeni === eski) return "Yeni parola mevcut paroladan farklı olmalı.";
  return null;
}

/* ---------- Şube kapsamı ---------- */

/** Rolün kapsamı: genel yönetici her zaman "tüm şubeler", diğerleri seçili şubeler */
export function kapsamDuzelt(rol: Rol, subeIds: string[] | "all", tumSubeler: string[]): string[] | "all" {
  if (rol === "genel-yonetici") return "all";
  const l = subeIds === "all" ? tumSubeler : subeIds;
  return [...new Set(l)];
}

/** Aktörün atayabileceği roller */
export function atanabilirRoller(aktorRol: Rol): Rol[] {
  if (aktorRol === "genel-yonetici") return [...ROLLER];
  return ROLLER.filter((r) => r !== "genel-yonetici" && ROL_SEVIYESI[r] <= ROL_SEVIYESI[aktorRol]);
}

/**
 * Aktör bu hesabı yönetebilir mi (düzenleme, parola sıfırlama)?
 * aktorKapsam: aktörün şube kapsamı (sunucudaki `kapsam()` sonucu).
 */
export function yonetimEngeli(aktor: Pick<Kullanici, "id" | "rol">, hedef: Pick<Kullanici, "rol" | "subeIds">, aktorKapsam: string[]): Hata {
  if (aktor.rol === "genel-yonetici") return null;
  if (hedef.rol === "genel-yonetici" || hedef.subeIds === "all") return "Genel yönetici hesabını yalnızca genel yönetici yönetebilir.";
  if (ROL_SEVIYESI[hedef.rol] > ROL_SEVIYESI[aktor.rol]) return "Kendinizden yetkili bir hesabı yönetemezsiniz.";
  if (!hedef.subeIds.length || hedef.subeIds.some((s) => !aktorKapsam.includes(s))) return "Bu kullanıcı şube kapsamınız dışında.";
  return null;
}

/** Parola sıfırlama: yönetim yetkisi + kendi parolası "Parola değiştir" ile değişir (eski parola sorulur) */
export function parolaSifirlamaEngeli(aktor: Pick<Kullanici, "id" | "rol">, hedef: Pick<Kullanici, "id" | "rol" | "subeIds">, aktorKapsam: string[]): Hata {
  if (aktor.id === hedef.id) return "Kendi parolanızı “Parola değiştir” ile değiştirin.";
  return yonetimEngeli(aktor, hedef, aktorKapsam);
}

/* ---------- Kullanıcı satırı ---------- */

type SatirBaglami = {
  kullanicilar: Kullanici[];
  personel: Pick<Personel, "id">[];
  subeler: { id: string }[];
};

/** Tek bir kullanıcı satırının alan kuralları (sonraki = değişiklik uygulanmış veri) */
export function kullaniciDogrula(k: Kullanici, sonraki: SatirBaglami): Hata {
  if (!k || typeof k !== "object") return "Geçersiz kullanıcı kaydı.";
  if (!rolGecerli(k.rol)) return "Geçersiz rol.";
  if (typeof k.aktif !== "boolean" || typeof k.ikiAdim !== "boolean") return "Geçersiz kullanıcı kaydı.";
  if (!sonraki.personel.some((p) => p.id === k.personelId)) return "Kullanıcının personel kartı bulunamadı.";
  if (sonraki.kullanicilar.some((x) => x.id !== k.id && x.personelId === k.personelId)) return "Bu personelin zaten bir kullanıcı hesabı var.";
  if (k.rol === "genel-yonetici") {
    if (k.subeIds !== "all") return "Genel yönetici tüm şubeleri kapsar.";
  } else {
    if (!Array.isArray(k.subeIds) || !k.subeIds.length) return "En az bir şube seçilmeli.";
    if (new Set(k.subeIds).size !== k.subeIds.length) return "Şube kapsamında yinelenen şube var.";
    if (k.subeIds.some((s) => !sonraki.subeler.some((x) => x.id === s))) return "Şube kapsamında tanımsız şube var.";
  }
  return epostaDogrula(k.eposta, sonraki.kullanicilar, k.id);
}

/** Kişinin kendi hesabında değiştiremeyeceği alanlar */
export function kendiHesabiEngeli(eski: Kullanici, yeni: Kullanici): Hata {
  if (yeni.rol !== eski.rol) return "Kendi rolünüzü değiştiremezsiniz.";
  if (!yeni.aktif && eski.aktif) return "Kendi hesabınızı pasife alamazsınız.";
  if (JSON.stringify(yeni.subeIds) !== JSON.stringify(eski.subeIds)) return "Kendi şube kapsamınızı değiştiremezsiniz.";
  return null;
}

/** Rol/kapsam değişikliği yetki yükseltmesi mi (genel yönetici olmayan aktör için) */
export function rolAtamaEngeli(aktorRol: Rol, yeniRol: Rol): Hata {
  if (aktorRol === "genel-yonetici") return null;
  if (yeniRol === "genel-yonetici") return "Genel yönetici yetkisi veremezsiniz.";
  if (ROL_SEVIYESI[yeniRol] > ROL_SEVIYESI[aktorRol]) return "Kendinizden yetkili bir rol atayamazsınız.";
  return null;
}

/** Kurumda her zaman en az bir aktif genel yönetici kalmalı */
export function sonGenelYoneticiEngeli(kullanicilar: Pick<Kullanici, "rol" | "aktif">[]): Hata {
  return kullanicilar.some((k) => k.rol === "genel-yonetici" && k.aktif) ? null : "Kurumda en az bir aktif genel yönetici kalmalı.";
}

/* ---------- Rol → bölüm yetki tablosu ---------- */

/** Tablo tüm rolleri ve bölümleri boolean olarak içermeli; genel yöneticinin hiçbir bölümü kapatılamaz */
export function rolYetkileriDogrula(t: unknown): Hata {
  if (!t || typeof t !== "object") return "Rol yetki tablosu geçersiz.";
  const tablo = t as Record<string, unknown>;
  if (Object.keys(tablo).some((r) => !rolGecerli(r))) return "Rol yetki tablosunda tanımsız rol var.";
  for (const r of ROLLER) {
    const satir = tablo[r];
    if (!satir || typeof satir !== "object") return "Rol yetki tablosu eksik.";
    const s = satir as Record<string, unknown>;
    if (Object.keys(s).some((k) => !(BOLUM_KODLARI as readonly string[]).includes(k))) return "Rol yetki tablosunda tanımsız bölüm var.";
    if (Object.values(s).some((v) => typeof v !== "boolean")) return "Rol yetki tablosu geçersiz.";
    if (r === "genel-yonetici" && BOLUM_KODLARI.some((k) => s[k] !== true)) return "Genel yöneticinin bölüm yetkileri kapatılamaz.";
  }
  return null;
}
