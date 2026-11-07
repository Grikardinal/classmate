/**
 * Kimlik doğrulama: parola özetleri (scrypt), oturumlar (httpOnly çerez + veritabanında özet), tek kullanımlık kodlar.
 * Bölüm 02 ve 14: personel e-posta + parola (+ isteğe bağlı SMS ile iki adım), veli telefon + SMS kodu.
 */
import { createHash, randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Veritabani } from "./veritabani";
import { PAROLA_EN_FAZLA, parolaKurali } from "../src/bolumler/02-kullanicilar/kurallar";

const scrypt = promisify(scryptCb) as (p: string, s: Buffer, n: number) => Promise<Buffer>;

export async function parolaOzeti(parola: string): Promise<string> {
  const tuz = randomBytes(16);
  const ozet = await scrypt(parola, tuz, 64);
  return `scrypt$${tuz.toString("base64")}$${ozet.toString("base64")}`;
}

/** Kullanıcı bulunamadığında da aynı sürede yanıt vermek için kullanılan sahte özet (e-posta varlığı süreden anlaşılmasın) */
const SAHTE_OZET = `scrypt$${randomBytes(16).toString("base64")}$${randomBytes(64).toString("base64")}`;

export async function parolaDogru(parola: string, kayitli: string | null | undefined): Promise<boolean> {
  // Aşırı uzun girdi scrypt'i yormasın (kural zaten en fazla 128 karakter)
  const p = parola.length > PAROLA_EN_FAZLA * 4 ? "" : parola;
  const [tur, tuzB64, ozetB64] = (kayitli ?? SAHTE_OZET).split("$");
  if (tur !== "scrypt" || !tuzB64 || !ozetB64) return false;
  const beklenen = Buffer.from(ozetB64, "base64");
  const ozet = await scrypt(p, Buffer.from(tuzB64, "base64"), beklenen.length);
  return !!kayitli && !!p && ozet.length === beklenen.length && timingSafeEqual(ozet, beklenen);
}

/** Parola kuralı (ekranla ortak: src/bolumler/02-kullanicilar/kurallar.ts · parolaKurali) */
export function parolaGucluMu(p: string) {
  return parolaKurali(p) === null;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export type OturumTuru = "personel" | "veli";
export type Oturum = { tur: OturumTuru; sahipId: string };

export async function oturumAc(vt: Veritabani, tur: OturumTuru, sahipId: string, saat: number, cihaz: string) {
  const belirtec = randomBytes(32).toString("base64url");
  // Süresi dolmuş oturumlar tabloda birikmesin
  await vt.q("delete from oturum where bitis <= now()");
  await vt.q("insert into oturum (belirtec_ozet, tur, sahip_id, bitis, cihaz) values ($1, $2, $3, now() + ($4 || ' hours')::interval, $5)", [
    sha256(belirtec), tur, sahipId, String(saat), cihaz.slice(0, 200),
  ]);
  return belirtec;
}

export async function oturumBul(vt: Veritabani, belirtec: string | undefined, tur: OturumTuru): Promise<Oturum | null> {
  if (!belirtec) return null;
  const r = await vt.q("select sahip_id from oturum where belirtec_ozet = $1 and tur = $2 and bitis > now()", [sha256(belirtec), tur]);
  return r.length ? { tur, sahipId: String(r[0].sahip_id) } : null;
}

export async function oturumKapat(vt: Veritabani, belirtec: string | undefined) {
  if (belirtec) await vt.q("delete from oturum where belirtec_ozet = $1", [sha256(belirtec)]);
}

/** Kullanıcının tüm oturumlarını kapat (parola değişince / hesap pasife alınınca) */
export async function tumOturumlariKapat(vt: Veritabani, tur: OturumTuru, sahipId: string) {
  await vt.q("delete from oturum where tur = $1 and sahip_id = $2", [tur, sahipId]);
}

/** Bu oturum dışındaki tüm oturumları kapat (kullanıcı kendi parolasını değiştirince) */
export async function digerOturumlariKapat(vt: Veritabani, tur: OturumTuru, sahipId: string, belirtec: string | undefined) {
  await vt.q("delete from oturum where tur = $1 and sahip_id = $2 and belirtec_ozet <> $3", [tur, sahipId, sha256(belirtec ?? "")]);
}

/* ---------- Tek kullanımlık kodlar (bellekte; 5 dk geçerli, en çok 5 deneme) ---------- */
type Kod = { ozet: string; bitis: number; deneme: number; veri: string };
const kodlar = new Map<string, Kod>();

export function kodUret(anahtar: string, veri = ""): string {
  const kod = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const simdi = Date.now();
  for (const [a, k] of kodlar) if (simdi > k.bitis) kodlar.delete(a); // süresi dolanlar birikmesin
  kodlar.set(anahtar, { ozet: sha256(anahtar + kod), bitis: Date.now() + 5 * 60_000, deneme: 0, veri });
  return kod;
}

export type KodSonucu = { tamam: true; veri: string } | { tamam: false; neden: "yok" | "sure" | "deneme" | "hatali"; kalan?: number };
export function kodDogrula(anahtar: string, kod: string): KodSonucu {
  const k = kodlar.get(anahtar);
  if (!k) return { tamam: false, neden: "yok" };
  if (Date.now() > k.bitis) {
    kodlar.delete(anahtar);
    return { tamam: false, neden: "sure" };
  }
  if (k.deneme >= 5) return { tamam: false, neden: "deneme" };
  const dogru = timingSafeEqual(Buffer.from(sha256(anahtar + kod)), Buffer.from(k.ozet));
  if (!dogru) {
    k.deneme++;
    return { tamam: false, neden: k.deneme >= 5 ? "deneme" : "hatali", kalan: 5 - k.deneme };
  }
  kodlar.delete(anahtar);
  return { tamam: true, veri: k.veri };
}

/* ---------- Deneme sınırı (bellekte, kayan pencere) ---------- */
const sayaclar = new Map<string, number[]>();
/** Pencere içinde en çok `sinir` deneme; aşıldıysa false */
export function denemeHakki(anahtar: string, sinir: number, pencereMs: number): boolean {
  const simdi = Date.now();
  const l = (sayaclar.get(anahtar) ?? []).filter((t) => simdi - t < pencereMs);
  if (l.length >= sinir) {
    sayaclar.set(anahtar, l);
    return false;
  }
  l.push(simdi);
  sayaclar.set(anahtar, l);
  return true;
}
export function denemeSifirla(anahtar: string) {
  sayaclar.delete(anahtar);
}

export function rastgeleParola(): string {
  const harf = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
  let p = "";
  for (let i = 0; i < 8; i++) p += harf[randomInt(0, harf.length)];
  return p + randomInt(10, 99);
}
