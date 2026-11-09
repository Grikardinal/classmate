/**
 * Bölüm 09 · Etüt ve birebir ders: saf iş kuralları.
 * Ekran (index.tsx ve alt dosyalar), veli portalı (11), sunucu (server/politika.ts · etutDenetle, veliVerisi;
 * server/uygulama.ts · /api/veli/randevu) aynı kuralları kullanır. Sunucu da içe aktardığı için yalnızca göreli içe aktarma kullanılır.
 * Hata dönen fonksiyonlar Türkçe mesaj, sorun yoksa null döndürür.
 */
import { BUGUN, SIMDI, aktifKayit, type Db, type DoluSaat, type EtutTuru, type Gonderim, type Musaitlik, type Paket, type ProgramSatiri, type Randevu, type RandevuSonucu, type Rol } from "../../data/model";
import { dakika, haftaGunu } from "../../lib/kurallar";
import type { Hata } from "../01-kurum-yapisi/kurallar";
import { satirGecerliMi, tarihGecerli } from "../06-ders-programi/kurallar";

export const etutTurAd: Record<EtutTuru, string> = { bireysel: "Bireysel etüt", grup: "Grup etüdü", online: "Online etüt", ozel: "Özel ders" };
export const SLOT_DK = 40;
/** Yarışta (iki veli aynı slot) API bu mesajla 409 döner */
export const SLOT_DOLU = "Bu saat az önce doldu. Başka bir saat seçin.";

/** Kuralların baktığı an: testler sabit verir, sunucu istek zamanını verir */
export type An = { bugun: string; simdi: string };

export const hhmm = (dk: number) => `${String(Math.floor(dk / 60)).padStart(2, "0")}:${String(dk % 60).padStart(2, "0")}`;
export const saatGecerli = (s: unknown): s is string => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const ortusur = (bas1: number, bit1: number, bas2: number, bit2: number) => bas1 < bit2 && bas2 < bit1;

/** Randevunun başlangıç saati geldi mi veya geçti mi? */
export function baslamisMi(r: Pick<Randevu, "tarih" | "bas">, an: An): boolean {
  return r.tarih < an.bugun || (r.tarih === an.bugun && r.bas <= an.simdi);
}

export function tatilMi(d: Pick<Db, "tatiller">, tarih: string, subeId: string): boolean {
  return d.tatiller.some((t) => t.tarih === tarih && (!t.subeId || t.subeId === subeId));
}

type DersVerisi = Pick<Db, "program" | "gruplar" | "dersSaatleri" | "sezonlar" | "tatiller" | "iptaller">;

/** O tarihte gerçekten yapılan grup dersleri (tatil, iptal, sezon dışı hariç) */
function yapilanDersler(d: DersVerisi, tarih: string, sec: (p: ProgramSatiri) => boolean): { bas: number; bit: number }[] {
  const gun = haftaGunu(tarih);
  const sonuc: { bas: number; bit: number }[] = [];
  for (const p of d.program) {
    if (p.gun !== gun || !satirGecerliMi(p, tarih) || !sec(p)) continue;
    const g = d.gruplar.find((x) => x.id === p.grupId);
    const h = d.dersSaatleri.find((x) => x.id === p.saatId);
    if (!g || !h) continue;
    const sezon = d.sezonlar.find((z) => z.id === g.sezonId);
    if (sezon && tarih > sezon.bitis) continue;
    if (tatilMi(d, tarih, g.subeId) || d.iptaller.some((i) => i.oturumId === `${p.id}_${tarih}`)) continue;
    sonuc.push({ bas: dakika(h.baslangic), bit: dakika(h.bitis) });
  }
  return sonuc;
}

/** Karar 2026-11-08: öğrencinin kendi grup dersiyle çakışan randevu engellenir (tatil / iptal günündeki ders sayılmaz) */
export function ogrenciDersiCakisir(d: DersVerisi & Pick<Db, "kayitlar">, ogrenciId: string, tarih: string, bas: string, bit: string): boolean {
  const gruplar = new Set(d.kayitlar.filter((k) => k.ogrenciId === ogrenciId && k.durum === "aktif").map((k) => k.grupId));
  return yapilanDersler(d, tarih, (p) => gruplar.has(p.grupId)).some((x) => ortusur(x.bas, x.bit, dakika(bas), dakika(bit)));
}

/** Öğretmenin o tarihte yapılan grup dersleri ve görünmeyen şubelerdeki dolu saatleri */
export function ogretmenDersAraliklari(d: DersVerisi & Pick<Db, "doluSaatler">, ogretmenId: string, tarih: string): { bas: number; bit: number }[] {
  const gun = haftaGunu(tarih);
  const sonuc = yapilanDersler(d, tarih, (p) => p.ogretmenId === ogretmenId);
  for (const s of d.doluSaatler ?? [])
    if (s.ogretmenId === ogretmenId && s.gun === gun && satirGecerliMi(s, tarih)) sonuc.push({ bas: dakika(s.bas), bit: dakika(s.bit) });
  return sonuc;
}

/** Öğretmen aktif, bu şubede görevli ve şube açık mı? (görünmeyen öğretmen de uygun sayılmaz) */
function musaitlikEtkin(d: Pick<Db, "personel" | "subeler">, m: Pick<Musaitlik, "ogretmenId" | "subeId">): boolean {
  const p = d.personel.find((x) => x.id === m.ogretmenId);
  return !!p && p.gorev === "ogretmen" && p.aktif && p.subeIds.includes(m.subeId) && d.subeler.find((s) => s.id === m.subeId)?.aktif !== false;
}

function ogretmenRandevuDolu(d: Pick<Db, "randevular">, ogretmenId: string, tarih: string, bas: number, bit: number, haricId?: string): boolean {
  return d.randevular.some((r) => r.id !== haricId && r.ogretmenId === ogretmenId && r.tarih === tarih && r.durum !== "iptal" && ortusur(dakika(r.bas), dakika(r.bit), bas, bit));
}

/** Öğretmenin bir tarihteki boş etüt slotları: müsaitlik − randevular − grup dersleri − tatil − geçmiş saatler */
export function bosSlotlar(d: Db, tarih: string, ogretmenId?: string, subeId?: string, an: An = { bugun: BUGUN, simdi: SIMDI }) {
  const gun = haftaGunu(tarih);
  const sonuc: { m: Musaitlik; bas: string; bit: string }[] = [];
  for (const m of d.musaitlikler) {
    if (m.gun !== gun || (ogretmenId && m.ogretmenId !== ogretmenId) || (subeId && m.subeId !== subeId)) continue;
    if (!musaitlikEtkin(d, m) || tatilMi(d, tarih, m.subeId)) continue;
    const dersler = ogretmenDersAraliklari(d, m.ogretmenId, tarih);
    for (let s = dakika(m.bas); s + SLOT_DK <= dakika(m.bit); s += SLOT_DK) {
      const bas = hhmm(s);
      const dolu = ogretmenRandevuDolu(d, m.ogretmenId, tarih, s, s + SLOT_DK) || dersler.some((x) => ortusur(x.bas, x.bit, s, s + SLOT_DK));
      if (!dolu && !baslamisMi({ tarih, bas }, an)) sonuc.push({ m, bas, bit: hhmm(s + SLOT_DK) });
    }
  }
  return sonuc;
}

/* ---------- Müsaitlik ---------- */

export function musaitlikEngeli(m: Musaitlik, d: Pick<Db, "musaitlikler" | "personel" | "subeler">): Hata {
  if (!m.ogretmenId) return "Öğretmen seçilmeli.";
  if (!m.subeId) return "Şube seçilmeli.";
  if (!Number.isInteger(m.gun) || m.gun < 1 || m.gun > 7) return "Gün hatalı.";
  if (!saatGecerli(m.bas) || !saatGecerli(m.bit)) return "Saat hatalı.";
  if (dakika(m.bas) >= dakika(m.bit)) return "Başlangıç saati bitişten önce olmalı.";
  if (dakika(m.bit) - dakika(m.bas) < SLOT_DK) return `Süre en az ${SLOT_DK} dakika olmalı.`;
  const p = d.personel.find((x) => x.id === m.ogretmenId);
  if (!p || p.gorev !== "ogretmen") return "Seçilen kişi öğretmen değil.";
  if (!p.aktif) return "Seçilen öğretmen pasif.";
  if (!p.subeIds.includes(m.subeId)) return "Seçilen öğretmen bu şubede görevli değil.";
  if (d.subeler.find((s) => s.id === m.subeId)?.aktif === false) return "Şube pasif.";
  const cakisan = d.musaitlikler.some((x) => x.id !== m.id && x.ogretmenId === m.ogretmenId && x.gun === m.gun && ortusur(dakika(x.bas), dakika(x.bit), dakika(m.bas), dakika(m.bit)));
  return cakisan ? "Bu öğretmenin o gün çakışan bir müsaitliği var." : null;
}

/* ---------- Paket hakkı ---------- */

/** Öğrenci → paket. Grup etüdünde paketIds, tek öğrencilide paketId geçerlidir. */
export function randevuPaketleri(r: Pick<Randevu, "paketId" | "paketIds" | "ogrenciIds">): Record<string, string> {
  if (r.paketIds) return r.paketIds;
  return r.paketId && r.ogrenciIds.length === 1 ? { [r.ogrenciIds[0]]: r.paketId } : {};
}

/** Planlı randevulara ayrılmış haklar düşüldükten sonra kalan hak (aynı hak iki randevuya verilmesin) */
export function kullanilabilirHak(p: Pick<Paket, "id" | "kalan">, randevular: Pick<Randevu, "id" | "paketId" | "paketIds" | "ogrenciIds" | "durum">[], haricId?: string): number {
  return p.kalan - randevular.filter((r) => r.durum === "planli" && r.id !== haricId && Object.values(randevuPaketleri(r)).includes(p.id)).length;
}

export function uygunPaket(d: Pick<Db, "paketler" | "randevular">, ogrenciId: string, ogretmenId: string): Paket | undefined {
  return d.paketler.find((p) => p.ogrenciId === ogrenciId && p.ogretmenId === ogretmenId && kullanilabilirHak(p, d.randevular) > 0);
}

/** Öğrencinin sonucu: öğrenci bazında kayıt yoksa randevu durumu (eski kayıtlar) */
export function ogrenciSonucu(r: Pick<Randevu, "durum" | "sonuclar">, ogrenciId: string): Randevu["durum"] {
  return r.sonuclar?.[ogrenciId] ?? r.durum;
}

/** En az bir öğrenci geldiyse randevu yapılmıştır */
export const sonuclardanDurum = (sonuclar: Record<string, RandevuSonucu>): RandevuSonucu => (Object.values(sonuclar).includes("yapildi") ? "yapildi" : "gelmedi");

const hakTuketir = (durum: Randevu["durum"], gelmeyenHakDussun: boolean) => durum === "yapildi" || (durum === "gelmedi" && gelmeyenHakDussun);

/**
 * Durum / sonuç değişikliğinin öğrenci bazında paket etkisi: paket → düşülecek hak (eksi = iade).
 * Yapıldı düşer; gelmedi kurum ayarına bağlı; iptal düşmez. Düzeltmede fark işlenir.
 */
export function sonucHakFarklari(eski: Randevu, yeni: Pick<Randevu, "durum" | "sonuclar">, gelmeyenHakDussun: boolean): Map<string, number> {
  const fark = new Map<string, number>();
  for (const [ogr, paketId] of Object.entries(randevuPaketleri(eski))) {
    const f = Number(hakTuketir(ogrenciSonucu(yeni, ogr), gelmeyenHakDussun)) - Number(hakTuketir(ogrenciSonucu(eski, ogr), gelmeyenHakDussun));
    if (f) fark.set(paketId, (fark.get(paketId) ?? 0) + f);
  }
  return fark;
}

/** Kalan hak sıfırın altına, toplamın üstüne çıkmaz */
export const kalanHakUygula = (p: Pick<Paket, "kalan" | "toplam">, dusum: number) => Math.min(p.toplam, Math.max(0, p.kalan - dusum));

export function paketYeniEngeli(p: Paket, d: Db): Hata {
  const o = d.ogrenciler.find((x) => x.id === p.ogrenciId);
  if (!o || o.durum !== "aktif" || !aktifKayit(d, o.id)) return "Öğrencinin aktif kaydı yok.";
  const ogr = d.personel.find((x) => x.id === p.ogretmenId);
  if (!ogr || ogr.gorev !== "ogretmen" || !ogr.aktif) return "Seçilen öğretmen aktif değil.";
  if (!d.dersler.some((x) => x.id === p.dersId)) return "Ders bulunamadı.";
  if (!Number.isInteger(p.toplam) || p.toplam < 1 || p.toplam > 500) return "Ders hakkı 1 ile 500 arasında tam sayı olmalı.";
  if (typeof p.fiyat !== "number" || !Number.isFinite(p.fiyat) || p.fiyat < 0) return "Ücret geçersiz.";
  return null;
}

/** Var olan pakette hiçbir tanım değişmez; kalan hak yalnızca randevu durumuyla değişir */
export function paketDegisimEngeli(p: Paket, eski: Paket, hakDusumu: number): Hata {
  if (p.ogrenciId !== eski.ogrenciId || p.ogretmenId !== eski.ogretmenId || p.dersId !== eski.dersId || p.toplam !== eski.toplam || p.tarih !== eski.tarih) return "Paket tanımı sonradan değiştirilemez.";
  if (!hakDusumu && p.kalan !== eski.kalan) return "Kalan hak yalnızca randevu sonucuyla değişir.";
  return null;
}

/* ---------- Randevu ---------- */

export type RandevuBaglami = An & { ogretmenGruplari: Set<string> | null };
const TURLER = Object.keys(etutTurAd) as EtutTuru[];

/** Karar 2026-11-08: kurum geneli, alan yoksa 6 */
export const grupKontenjani = (a: { etutGrupKontenjan?: number } | undefined) => a?.etutGrupKontenjan ?? 6;
export const kontenjanGecerli = (n: unknown) => n === undefined || (Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 50);

/** Çakışmalar: tatil, öğretmenin randevusu ve grup dersi, öğrencinin başka randevusu */
export function randevuCakismaEngeli(r: Randevu, d: Db): Hata {
  const bas = dakika(r.bas);
  const bit = dakika(r.bit);
  if (tatilMi(d, r.tarih, r.subeId)) return "Bu tarih tatil.";
  if (ogretmenRandevuDolu(d, r.ogretmenId, r.tarih, bas, bit, r.id)) return SLOT_DOLU;
  if (ogretmenDersAraliklari(d, r.ogretmenId, r.tarih).some((x) => ortusur(x.bas, x.bit, bas, bit))) return "Öğretmenin bu saatte grup dersi var.";
  const ogrenciDolu = d.randevular.some((x) => x.id !== r.id && x.tarih === r.tarih && x.durum !== "iptal" && x.ogrenciIds.some((o) => r.ogrenciIds.includes(o)) && ortusur(dakika(x.bas), dakika(x.bit), bas, bit));
  if (ogrenciDolu) return "Öğrencinin bu saatte başka bir randevusu var.";
  return r.ogrenciIds.some((o) => ogrenciDersiCakisir(d, o, r.tarih, r.bas, r.bit)) ? "Öğrencinin bu saatte grup dersi var." : null;
}

/** Müsaitlik içinde ve slot ızgarasına oturan bir başlangıç mı? */
function slotMusaitMi(r: Randevu, d: Db): boolean {
  const bas = dakika(r.bas);
  return d.musaitlikler.some(
    (m) => m.ogretmenId === r.ogretmenId && m.subeId === r.subeId && m.gun === haftaGunu(r.tarih) && dakika(m.bas) <= bas && bas + SLOT_DK <= dakika(m.bit) && (bas - dakika(m.bas)) % SLOT_DK === 0 && musaitlikEtkin(d, m),
  );
}

export function randevuYeniEngeli(r: Randevu, d: Db, b: RandevuBaglami): Hata {
  if (!tarihGecerli(r.tarih) || !saatGecerli(r.bas) || !saatGecerli(r.bit)) return "Tarih veya saat hatalı.";
  if (dakika(r.bit) - dakika(r.bas) !== SLOT_DK) return `Randevu süresi ${SLOT_DK} dakikadır.`;
  if (!TURLER.includes(r.tur)) return "Etüt türü hatalı.";
  if (r.durum !== "planli") return "Yeni randevu planlı olmalı.";
  if (baslamisMi(r, b)) return "Geçmiş bir saate randevu alınamaz.";
  if (!slotMusaitMi(r, d)) return "Bu saat öğretmenin müsaitlik saatleri içinde değil.";
  if (!Array.isArray(r.ogrenciIds) || !r.ogrenciIds.length) return "Öğrenci seçilmeli.";
  if (new Set(r.ogrenciIds).size !== r.ogrenciIds.length) return "Aynı öğrenci iki kez seçilemez.";
  if (r.tur !== "grup" && r.ogrenciIds.length !== 1) return "Bu etüt türü tek öğrencilidir.";
  if (r.tur === "grup" && r.ogrenciIds.length > grupKontenjani(d.ayarlar)) return `Grup etüdü en fazla ${grupKontenjani(d.ayarlar)} öğrencilidir.`;
  for (const id of r.ogrenciIds) {
    const k = d.ogrenciler.find((o) => o.id === id)?.durum === "aktif" ? aktifKayit(d, id) : undefined;
    if (!k || k.subeId !== r.subeId) return "Öğrencinin bu şubede aktif kaydı yok.";
    if (b.ogretmenGruplari && !b.ogretmenGruplari.has(k.grupId)) return "Yalnızca kendi gruplarınızdaki öğrencilere randevu verebilirsiniz.";
  }
  if (!d.dersler.some((x) => x.id === r.dersId)) return "Ders bulunamadı.";
  if (r.tur === "online" ? !/^https?:\/\/\S+$/.test(String(r.link)) || r.link.length > 500 : r.link !== "") return r.tur === "online" ? "Görüşme linki http(s) ile başlamalı." : "Görüşme linki yalnızca online etütte girilir.";
  if (r.paketId && r.ogrenciIds.length !== 1) return "Paket bu öğrenci ve öğretmene ait değil.";
  if (r.paketIds && r.tur !== "grup") return "Öğrenci bazında paket yalnızca grup etüdünde kullanılır.";
  const paketler = Object.entries(randevuPaketleri(r));
  for (const [ogr, paketId] of paketler) {
    const p = d.paketler.find((x) => x.id === paketId);
    if (!p || !r.ogrenciIds.includes(ogr) || p.ogrenciId !== ogr || p.ogretmenId !== r.ogretmenId) return "Paket bu öğrenci ve öğretmene ait değil.";
    if (p.dersId !== r.dersId) return "Randevunun dersi paketin dersi olmalı.";
    if (kullanilabilirHak(p, d.randevular, r.id) < 1) return "Paketin kullanılabilir hakkı kalmadı.";
  }
  if (r.tur === "ozel" && !paketler.length) return "Özel ders için aktif paket gerekli.";
  return randevuCakismaEngeli(r, d);
}

const ALANLAR: (keyof Randevu)[] = ["ogretmenId", "subeId", "tarih", "bas", "bit", "tur", "ogrenciIds", "dersId", "link", "paketId", "paketIds", "olusturan"];
const esit = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const SONUCLANMIS = "Sonuçlanmış randevu yalnızca gerekçeli düzeltmeyle değişir.";
export const yoneticiDuzeltir = (rol: Rol) => rol === "genel-yonetici" || rol === "sube-muduru";

/** Öğrenci bazında sonuçlar: tüm öğrenciler, geçerli değer, randevu durumuyla uyumlu. Yoksa durum herkese uygulanır. */
function sonuclarEngeli(s: Randevu): Hata {
  if (s.durum !== "yapildi" && s.durum !== "gelmedi") return "Randevu durumu hatalı.";
  if (!s.sonuclar) return null;
  const anahtarlar = Object.keys(s.sonuclar);
  if (anahtarlar.length !== s.ogrenciIds.length || !s.ogrenciIds.every((o) => anahtarlar.includes(o))) return "Her öğrenci için sonuç girilmeli.";
  if (Object.values(s.sonuclar).some((x) => x !== "yapildi" && x !== "gelmedi")) return "Öğrenci sonucu hatalı.";
  return s.durum === sonuclardanDurum(s.sonuclar) ? null : "Randevu durumu öğrenci sonuçlarıyla uyuşmuyor.";
}

/** Var olan randevuda yalnızca sonuç değişir. Planlıdan bir kez çıkılır; yanlış sonucu yalnızca yönetici gerekçeyle düzeltir. */
export function randevuDurumEngeli(s: Randevu, eski: Randevu, b: An & { rol: Rol }): Hata {
  if (ALANLAR.some((a) => !esit(s[a], eski[a]))) return "Randevu bilgileri değiştirilemez; iptal edip yenisini oluşturun.";
  const duzeltmeDegisti = !esit(s.duzeltmeler ?? [], eski.duzeltmeler ?? []);
  if (s.durum === eski.durum && esit(s.sonuclar, eski.sonuclar) && !duzeltmeDegisti) return null;
  if (eski.durum === "yapildi" || eski.durum === "gelmedi") {
    const onceki = eski.duzeltmeler ?? [];
    const yeni = s.duzeltmeler ?? [];
    if (yeni.length !== onceki.length + 1 || !esit(yeni.slice(0, -1), onceki)) return SONUCLANMIS;
    if (!yoneticiDuzeltir(b.rol)) return "Sonucu yalnızca şube müdürü veya genel yönetici düzeltebilir.";
    if (typeof yeni[yeni.length - 1]?.neden !== "string" || yeni[yeni.length - 1].neden.trim().length < 3) return "Düzeltme gerekçesi en az 3 karakter olmalı.";
    if (s.durum === eski.durum && esit(s.sonuclar, eski.sonuclar)) return "Sonuç değişmedi.";
    return sonuclarEngeli(s);
  }
  if (eski.durum === "iptal") return "İptal edilmiş randevu değiştirilemez.";
  if (duzeltmeDegisti) return "Düzeltme yalnızca sonuçlanmış randevuda yapılır.";
  if (s.durum === "iptal") {
    if (s.sonuclar) return "İptalde öğrenci sonucu girilmez.";
    return b.rol === "ogretmen" && baslamisMi(eski, b) ? "Başlamış randevuyu yalnızca yönetim iptal edebilir." : null;
  }
  const hata = sonuclarEngeli(s);
  if (hata) return hata;
  return baslamisMi(eski, b) ? null : "Başlamamış randevu sonuçlandırılamaz.";
}

/* ---------- Veli ---------- */

/** Veli isteğinden randevu üretir. Sunucu bunu yazma kuyruğunun içinde çağırır (yarışta ikinci istek dolu görür). */
export function veliRandevuPlani(d: Db, g: { ogrenciId: string; ogretmenId: string; tarih: unknown; bas: unknown }, an: An): { hata: string } | { randevu: Randevu } {
  if (!tarihGecerli(g.tarih) || !saatGecerli(g.bas)) return { hata: "Tarih veya saat hatalı." };
  const subeId = aktifKayit(d, g.ogrenciId)?.subeId;
  if (!subeId) return { hata: "Öğrencinin aktif kaydı yok." };
  const paket = uygunPaket(d, g.ogrenciId, g.ogretmenId);
  const dersId = paket?.dersId ?? d.personel.find((p) => p.id === g.ogretmenId)?.dersIds[0] ?? d.dersler.find((x) => x.aktif)?.id ?? "";
  const randevu: Randevu = {
    id: "__yeni", ogretmenId: g.ogretmenId, subeId, tarih: g.tarih, bas: g.bas, bit: hhmm(dakika(g.bas) + SLOT_DK), tur: paket ? "ozel" : "bireysel",
    ogrenciIds: [g.ogrenciId], dersId, durum: "planli", link: "", paketId: paket?.id ?? null, olusturan: "veli",
  };
  const hata = randevuYeniEngeli(randevu, d, { ...an, ogretmenGruplari: null });
  return hata ? { hata } : { randevu };
}

/** Doküman: veli en geç X saat öncesine kadar iptal eder (X = ayarlar.etutIptalSaat) */
export function veliIptalEngeli(r: Pick<Randevu, "tarih" | "bas" | "durum">, iptalSaat: number, an: An): Hata {
  if (r.durum !== "planli") return "Bu randevu iptal edilemez.";
  const kalan = (new Date(`${r.tarih}T${r.bas}`).getTime() - new Date(`${an.bugun}T${an.simdi}`).getTime()) / 36e5;
  return kalan <= 0 || kalan < iptalSaat ? `Randevular en geç ${iptalSaat} saat öncesine kadar iptal edilebilir.` : null;
}

/** Grup etüdünden yalnızca verilen öğrenciler çıkar (veli iptali, kayıt iptali); öğrenci kalmadıysa randevu iptal olur */
export function ogrencileriCikar(r: Randevu, ids: Set<string>): Randevu {
  const kalan = r.ogrenciIds.filter((o) => !ids.has(o));
  if (!kalan.length) return { ...r, durum: "iptal" };
  const y: Randevu = { ...r, ogrenciIds: kalan };
  if (r.paketIds) y.paketIds = Object.fromEntries(Object.entries(r.paketIds).filter(([o]) => !ids.has(o)));
  return y;
}

/**
 * Veliye giden etüt verisi. Başka öğrencinin randevusu yalnızca dolu saat olur (kim, ne dersi yok).
 * Slotu gerçek göstermek için öğretmenin diğer şubelerdeki randevusu ve grup dersleri de saat olarak gider.
 */
export function veliEtutVerisi(db: Db, ogrIds: Set<string>, subeIds: Set<string>) {
  if (db.moduller?.etut === false) return { musaitlikler: [] as Musaitlik[], randevular: [] as Randevu[], paketler: [] as Paket[], doluSaatler: [] as DoluSaat[], ogretmenIds: [] as string[] };
  const musaitlikler = db.musaitlikler.filter((m) => subeIds.has(m.subeId));
  const slotOgretmenleri = new Set(musaitlikler.map((m) => m.ogretmenId));
  const randevular: Randevu[] = [];
  for (const r of db.randevular) {
    const { duzeltmeler: _d, sonuclar: _s, paketIds: _p, ...temel } = r;
    void _d;
    if (r.ogrenciIds.some((x) => ogrIds.has(x))) {
      // Veliye yalnızca kendi çocuğunun sonucu ve paketi; düzeltme gerekçesi personelindir
      const benim = <T,>(m: Record<string, T> | undefined) => (m ? Object.fromEntries(Object.entries(m).filter(([o]) => ogrIds.has(o))) : undefined);
      const sonuclar = benim(_s);
      randevular.push({ ...temel, ogrenciIds: r.ogrenciIds.filter((x) => ogrIds.has(x)), ...(_p ? { paketIds: benim(_p) } : {}), ...(sonuclar ? { sonuclar, durum: sonuclardanDurum(sonuclar) } : {}) });
    } else if (r.durum !== "iptal" && slotOgretmenleri.has(r.ogretmenId)) randevular.push({ ...temel, durum: "planli", tur: "bireysel", ogrenciIds: [], dersId: "", link: "", paketId: null, olusturan: "yonetim" });
  }
  const doluSaatler: DoluSaat[] = [];
  for (const p of db.program) {
    if (!slotOgretmenleri.has(p.ogretmenId)) continue;
    const g = db.gruplar.find((x) => x.id === p.grupId);
    const h = db.dersSaatleri.find((x) => x.id === p.saatId);
    if (g && h) doluSaatler.push({ ogretmenId: p.ogretmenId, gun: p.gun, bas: h.baslangic, bit: h.bitis, baslangic: p.baslangic, bitis: p.bitis ?? db.sezonlar.find((z) => z.id === g.sezonId)?.bitis ?? null });
  }
  return {
    musaitlikler,
    randevular,
    paketler: db.paketler.filter((p) => ogrIds.has(p.ogrenciId)).map((p) => (db.moduller?.finans ? p : { ...p, fiyat: 0 })),
    doluSaatler,
    ogretmenIds: [...new Set([...slotOgretmenleri, ...randevular.filter((r) => r.ogrenciIds.length).map((r) => r.ogretmenId)])],
  };
}

/* ---------- Bildirim ---------- */

export const etutBildirimiMi = (olay: Gonderim["olay"]) => olay === "etutHatirlatma";

/** Aynı veliye, aynı öğrenci ve randevu için aynı olay ikinci kez gitmez */
export function etutBildirimiYineleniyor(g: Pick<Gonderim, "olay" | "veliId" | "ogrenciId">, randevuId: string, mevcut: Pick<Gonderim, "olay" | "veliId" | "ogrenciId" | "randevuId">[]): boolean {
  return mevcut.some((x) => x.olay === g.olay && x.veliId === g.veliId && x.ogrenciId === g.ogrenciId && x.randevuId === randevuId);
}

export const paketBilgiMetni = (dersAd: string, kalan: number) => `${dersAd} paketinizde ${kalan} ders hakkı kaldı.`;

/** "Paket bitiyor" bir paket için bir kez gider (otomatik veya düğmeyle). Bağ alanından önceki düğme bildirimleri metinle eşleşir. */
export function paketBildirimiGitti(gonderimler: Pick<Gonderim, "olay" | "ogrenciId" | "metin" | "paketId">[], p: Pick<Paket, "id" | "ogrenciId" | "kalan">, dersAd: string): boolean {
  return gonderimler.some((g) => (g.olay === "paketBitiyor" && g.paketId === p.id) || (g.olay === "duyuru" && g.ogrenciId === p.ogrenciId && g.metin.includes(paketBilgiMetni(dersAd, p.kalan))));
}

/** Öğretmenin takvimde göreceği yaklaşan randevuları (personel bildirim kanalı yok, karar 2026-11-09) */
export function yaklasanRandevular<T extends Pick<Randevu, "ogretmenId" | "durum" | "tarih" | "bas">>(randevular: T[], ogretmenId: string, an: { bugun: string; simdi: string }, adet = 5): T[] {
  return randevular
    .filter((r) => r.ogretmenId === ogretmenId && r.durum === "planli" && (r.tarih > an.bugun || (r.tarih === an.bugun && r.bas >= an.simdi)))
    .sort((a, b) => a.tarih.localeCompare(b.tarih) || a.bas.localeCompare(b.bas))
    .slice(0, adet);
}
