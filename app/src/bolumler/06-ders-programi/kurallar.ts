/**
 * Bölüm 06 · Ders programı: saf iş kuralları.
 * Ekran (index.tsx ve alt dosyalar) ve sunucu (server/politika.ts · programDenetle) aynı kuralları kullanır.
 * Sunucu da içe aktardığı için burada yalnızca göreli içe aktarma kullanılır.
 * Hata dönen fonksiyonlar Türkçe mesaj, sorun yoksa null döndürür.
 */
import type { Db, DoluSaat, Iptal, Personel, ProgramSatiri, Randevu, Rol, Sezon, Tatil, YedekAtama } from "../../data/model";
import { cakismaBul, dakika, haftaGunu, subeGecisUyarisi, tarihEkle, type Cakisma, type Slot } from "../../lib/kurallar";
import { programAtamaEngeli, tanimAktif, type Hata } from "../01-kurum-yapisi/kurallar";

type Tanimlar = Pick<Db, "gruplar" | "dersSaatleri">;
type Kayitlar = Pick<Db, "yoklamalar" | "iptaller">;

export const OGRETMEN_SECILMELI = "Öğretmen seçilmeli.";

/* ---------- Tarih ---------- */

/** Gerçek bir takvim günü mü (YYYY-MM-DD)? */
export function tarihGecerli(t: unknown): t is string {
  if (typeof t !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return false;
  const d = new Date(`${t}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === t;
}

const tarihYaz = (t: string) => t.split("-").reverse().join(".");

/** Oturum kimliği "<satırId>_<tarih>" biçimindedir */
export function oturumKimligi(oturumId: unknown): { satirId: string; tarih: string } | null {
  if (typeof oturumId !== "string") return null;
  const i = oturumId.lastIndexOf("_");
  if (i <= 0 || !tarihGecerli(oturumId.slice(i + 1))) return null;
  return { satirId: oturumId.slice(0, i), tarih: oturumId.slice(i + 1) };
}

/** Satır o tarihte yürürlükte mi? (haftanın gününe bakmaz) */
export function satirGecerliMi(p: Pick<ProgramSatiri, "baslangic" | "bitis">, tarih: string): boolean {
  return p.baslangic <= tarih && (!p.bitis || p.bitis >= tarih);
}

export function gecerliSatirlar(program: ProgramSatiri[], tarih: string): ProgramSatiri[] {
  return program.filter((p) => satirGecerliMi(p, tarih));
}

/** O haftada (hafta = pazartesi) kendi gününde yürürlükte olan satırlar */
export function haftaSatirlari(program: ProgramSatiri[], hafta: string): ProgramSatiri[] {
  return program.filter((p) => satirGecerliMi(p, tarihEkle(hafta, p.gun - 1)));
}

/** İki satırın yürürlük aralıkları, verilen haftanın gününe denk gelen ortak bir tarih içeriyor mu? */
export function aralikGunuOrtusur(a: Pick<ProgramSatiri, "baslangic" | "bitis">, b: Pick<ProgramSatiri, "baslangic" | "bitis">, gun: number): boolean {
  const bas = a.baslangic > b.baslangic ? a.baslangic : b.baslangic;
  const bit = !a.bitis ? b.bitis : !b.bitis ? a.bitis : a.bitis < b.bitis ? a.bitis : b.bitis;
  for (let i = 0; i < 7; i++) {
    const t = tarihEkle(bas, i);
    if (bit && t > bit) return false;
    if (haftaGunu(t) === gun) return true;
  }
  return false;
}

/* ---------- Çakışma ---------- */

/** Görünmeyen / silinmiş grup veya ders saatine bağlı satırda null */
export function satirSlotu(d: Tanimlar, p: ProgramSatiri): Slot | null {
  const h = d.dersSaatleri.find((x) => x.id === p.saatId);
  const g = d.gruplar.find((x) => x.id === p.grupId);
  if (!h || !g) return null;
  return { id: p.id, gun: p.gun, bas: dakika(h.baslangic), bit: dakika(h.bitis), ogretmenId: p.ogretmenId, derslikId: p.derslikId, grupId: p.grupId, subeId: g.subeId };
}

/** Satırla aynı günde ve örtüşen tarih aralığında yürürlükte olan diğer satırların slotları */
function ortusenSlotlar(yeni: ProgramSatiri, program: ProgramSatiri[], d: Tanimlar): Slot[] {
  return program
    .filter((p) => p.id !== yeni.id && p.gun === yeni.gun && aralikGunuOrtusur(p, yeni, yeni.gun))
    .map((p) => satirSlotu(d, p))
    .filter((s): s is Slot => !!s);
}

/** Aynı öğretmen / derslik / grup, yürürlük tarihleri kesişiyorsa aynı saatte iki yerde olamaz */
export function programCakismalari(yeni: ProgramSatiri, program: ProgramSatiri[], d: Tanimlar): Cakisma[] {
  const slot = satirSlotu(d, yeni);
  return slot ? cakismaBul(slot, ortusenSlotlar(yeni, program, d)) : [];
}

/** Öğretmenin farklı şubedeki dersiyle arasında yeterli süre kalmayan dersler (uyarı; onayla geçilir) */
export function programGecisleri(yeni: ProgramSatiri, program: ProgramSatiri[], d: Tanimlar, minDakika: number): Slot[] {
  const slot = satirSlotu(d, yeni);
  return slot ? subeGecisUyarisi(slot, ortusenSlotlar(yeni, program, d), minDakika) : [];
}

/** Sunucu mesajı: başka şubenin dersini ele vermez */
export function cakismaMesaji(c: Cakisma): string {
  const ad = c.tur === "ogretmen" ? "Öğretmen" : c.tur === "derslik" ? "Derslik" : "Grup";
  return `${ad} bu saatte dolu.`;
}

/* ---------- Değişiklik tarihi: geçmiş korunur ---------- */

/** Satırın yoklaması veya iptali olan son oturumunun tarihi; bu oturumlar satıra kimlikle bağlıdır */
export function sonKilitliOturum(p: Pick<ProgramSatiri, "id">, d: Kayitlar): string | null {
  const tarihler = [
    ...Object.values(d.yoklamalar ?? {}).filter((y) => y.satirId === p.id).map((y) => y.tarih),
    ...(d.iptaller ?? []).map((i) => oturumKimligi(i.oturumId)).filter((k) => k?.satirId === p.id).map((k) => k!.tarih),
  ];
  return tarihler.length ? tarihler.reduce((a, b) => (a > b ? a : b)) : null;
}

/** Değişikliğin uygulanabileceği ilk tarih: bugün veya yoklaması/iptali olan son oturumun ertesi */
export function enErkenGecerlilik(p: Pick<ProgramSatiri, "id">, d: Kayitlar, bugun: string): string {
  const kilit = sonKilitliOturum(p, d);
  const sonraki = kilit ? tarihEkle(kilit, 1) : bugun;
  return sonraki > bugun ? sonraki : bugun;
}

export function degisiklikTarihiEngeli(p: ProgramSatiri, gecerlilik: string, d: Kayitlar, bugun: string): Hata {
  if (!tarihGecerli(gecerlilik)) return "Geçerlilik tarihi hatalı.";
  if (gecerlilik < bugun) return "Program değişikliği geçmişe uygulanamaz.";
  const kilit = sonKilitliOturum(p, d);
  if (kilit && gecerlilik <= kilit) return `${tarihYaz(kilit)} tarihli dersin yoklaması veya iptali var; değişiklik ${tarihYaz(tarihEkle(kilit, 1))} ve sonrası için yapılabilir.`;
  if (p.bitis && gecerlilik > p.bitis) return `Bu ders ${tarihYaz(p.bitis)} tarihinde sona eriyor; bu tarihten sonra değiştirilemez.`;
  return null;
}

/**
 * Değişiklik belirtilen tarihten itibaren geçerli olur (doküman: geçmiş oturumlar etkilenmez).
 * Satır henüz başlamadıysa yerinde değişir veya silinir; başladıysa kapatılır ve yeni satır açılır.
 * Kapatılan satırın kimliği korunduğu için yoklama ve iptaller geçmiş oturumlara bağlı kalır.
 */
export function programDegistir(program: ProgramSatiri[], eski: ProgramSatiri, yeni: ProgramSatiri | null, gecerlilik: string, idUret: () => string): ProgramSatiri[] {
  if (eski.baslangic >= gecerlilik) return yeni ? program.map((p) => (p.id === eski.id ? { ...yeni, id: eski.id, bitis: eski.bitis } : p)) : program.filter((p) => p.id !== eski.id);
  const kapali = program.map((p) => (p.id === eski.id ? { ...p, bitis: tarihEkle(gecerlilik, -1) } : p));
  return yeni ? [...kapali, { ...yeni, id: idUret(), baslangic: gecerlilik, bitis: eski.bitis }] : kapali;
}

/* ---------- Satır doğrulama ---------- */

/** Bu şubede görevli, aktif ve bu dersi verebilen öğretmenler */
export function uygunOgretmenler(personel: Personel[], dersId: string, subeId: string): Personel[] {
  return personel.filter((p) => p.gorev === "ogretmen" && p.aktif && p.subeIds.includes(subeId) && p.dersIds.includes(dersId));
}

/** Karar 2026-11-08: branş dışı (yedek) öğretmeni yalnızca şube müdürü veya genel yönetici atar */
export function bransDisiAtayabilir(rol: Rol): boolean {
  return rol === "genel-yonetici" || rol === "sube-muduru";
}

/** Bu şubede görevli, aktif ama bu dersi vermeyen öğretmenler (yalnızca yöneticiye listelenir) */
export function bransDisiOgretmenler(personel: Personel[], dersId: string, subeId: string): Personel[] {
  return personel.filter((p) => p.gorev === "ogretmen" && p.aktif && p.subeIds.includes(subeId) && !p.dersIds.includes(dersId));
}

export type AtamaSecenegi = { bransDisi?: boolean };

export function ogretmenUygunlukEngeli(ogretmenId: string, dersId: string, subeId: string, personel: Personel[], bransDisi = false): Hata {
  if (!ogretmenId) return OGRETMEN_SECILMELI;
  const p = personel.find((x) => x.id === ogretmenId);
  if (!p || p.gorev !== "ogretmen") return "Seçilen kişi öğretmen değil.";
  if (!p.aktif) return "Seçilen öğretmen pasif.";
  if (!p.subeIds.includes(subeId)) return "Seçilen öğretmen bu şubede görevli değil.";
  if (!p.dersIds.includes(dersId) && !bransDisi) return "Seçilen öğretmen bu dersi vermiyor; branş dışı atamayı yalnızca yönetici yapabilir.";
  return null;
}

type SatirTanimlari = Pick<Db, "gruplar" | "dersSaatleri" | "derslikler" | "dersler" | "personel" | "subeler" | "sezonlar">;

/** Alan, şube uyumu, sezon ve öğretmen kuralları. Var olan satırda yalnızca değişen alan denetlenir (eski atama kaydı kilitlemesin). */
export function programSatirEngeli(p: ProgramSatiri, eski: ProgramSatiri | undefined, d: SatirTanimlari, secenek: AtamaSecenegi = {}): Hata {
  const degisti = (...alanlar: (keyof ProgramSatiri)[]) => !eski || alanlar.some((a) => p[a] !== eski[a]);
  const g = d.gruplar.find((x) => x.id === p.grupId);
  if (!g) return "Grup bulunamadı.";
  if (!Number.isInteger(p.gun) || p.gun < 1 || p.gun > 7) return "Gün hatalı.";
  if (!tarihGecerli(p.baslangic)) return "Başlangıç tarihi hatalı.";
  if (p.bitis !== null && !tarihGecerli(p.bitis)) return "Bitiş tarihi hatalı.";
  if (p.bitis && p.bitis < p.baslangic) return "Bitiş tarihi başlangıçtan önce olamaz.";
  if (degisti("grupId") && d.subeler.find((s) => s.id === g.subeId)?.aktif === false) return "Grubun şubesi pasif.";

  if (degisti("saatId", "grupId", "gun")) {
    const h = d.dersSaatleri.find((x) => x.id === p.saatId);
    if (!h) return "Ders saati bulunamadı.";
    if (h.subeId !== g.subeId) return "Ders saati grubun şubesine ait değil.";
    if ((h.gunTipi === "hafta-sonu") !== p.gun >= 6) return "Ders saati bu günün tipine (hafta içi / hafta sonu) uymuyor.";
  }
  if (degisti("derslikId", "grupId")) {
    const dl = d.derslikler.find((x) => x.id === p.derslikId);
    if (!dl) return "Derslik bulunamadı.";
    if (dl.subeId !== g.subeId) return "Derslik grubun şubesine ait değil.";
  }
  if (degisti("dersId")) {
    const ds = d.dersler.find((x) => x.id === p.dersId);
    if (!ds) return "Ders bulunamadı.";
    if (!tanimAktif(ds)) return "Seçilen ders pasif.";
  }
  if (degisti("baslangic", "bitis", "grupId")) {
    const z = d.sezonlar.find((x) => x.id === g.sezonId);
    if (z && (p.baslangic < z.baslangic || p.baslangic > z.bitis)) return `Başlangıç tarihi grubun sezonu içinde olmalı (${tarihYaz(z.baslangic)} – ${tarihYaz(z.bitis)}).`;
    if (z && p.bitis && p.bitis > z.bitis) return `Bitiş tarihi grubun sezonunu aşamaz (${tarihYaz(z.bitis)}).`;
  }
  if (degisti("ogretmenId", "dersId", "grupId")) return ogretmenUygunlukEngeli(p.ogretmenId, p.dersId, g.subeId, d.personel, secenek.bransDisi);
  return null;
}

export type DegisiklikSonucu = {
  /** Değişiklikten sonraki hali */
  satir: ProgramSatiri;
  liste: ProgramSatiri[];
  tarihEngeli: Hata;
  atamaEngeli: Hata;
  cakismalar: Cakisma[];
  gecisler: Slot[];
};

/** Pencere ve sürükle-bırak aynı denetimden geçer. eski yoksa yeni satır eklenir. */
export function degisiklikDenetle(d: Db, eski: ProgramSatiri | undefined, yeni: ProgramSatiri, gecerlilik: string, bugun: string, secenek: AtamaSecenegi = {}): DegisiklikSonucu {
  const taslakId = "__yeni";
  const yerinde = !!eski && eski.baslangic >= gecerlilik;
  const liste = eski ? programDegistir(d.program, eski, yeni, gecerlilik, () => taslakId) : [...d.program, { ...yeni, id: taslakId }];
  const satir = liste.find((p) => p.id === (yerinde ? eski!.id : taslakId))!;
  const karsilastirma = yerinde ? eski : undefined;
  return {
    satir,
    liste,
    tarihEngeli: eski ? degisiklikTarihiEngeli(eski, gecerlilik, d, bugun) : !tarihGecerli(gecerlilik) ? "Geçerlilik tarihi hatalı." : gecerlilik < bugun ? "Ders geçmiş tarihten başlatılamaz." : null,
    atamaEngeli: programAtamaEngeli(satir, karsilastirma, d) ?? programSatirEngeli(satir, karsilastirma, d, secenek),
    cakismalar: programCakismalari(satir, liste, d),
    gecisler: programGecisleri(satir, liste, d, d.ayarlar.subeGecisDk),
  };
}

/* ---------- Sunucu: satır yazma / silme ---------- */

type DenetimVerisi = SatirTanimlari & Kayitlar & Pick<Db, "program"> & YedekVerisi;

const ALANLAR: (keyof ProgramSatiri)[] = ["grupId", "gun", "saatId", "dersId", "ogretmenId", "derslikId", "baslangic"];

/** Var olan satırın yalnızca bitişi öne çekildi veya hiç değişmedi mi (bölme / kapatma)? */
function yalnizKapatma(s: ProgramSatiri, eski: ProgramSatiri): boolean {
  return ALANLAR.every((a) => s[a] === eski[a]) && (s.bitis === eski.bitis || (!!s.bitis && (!eski.bitis || s.bitis <= eski.bitis)));
}

export function programYazmaEngeli(s: ProgramSatiri, eski: ProgramSatiri | undefined, d: DenetimVerisi, bugun: string, secenek: AtamaSecenegi = {}): Hata {
  if (eski && yalnizKapatma(s, eski)) {
    if (s.bitis === eski.bitis) return null;
    if (!tarihGecerli(s.bitis)) return "Bitiş tarihi hatalı.";
    if (s.bitis < tarihEkle(bugun, -1)) return "Geçmiş oturumlar etkilenemez; ders en erken dün itibarıyla kapatılabilir.";
    if (s.bitis < s.baslangic) return "Bitiş tarihi başlangıçtan önce olamaz.";
    const kilit = sonKilitliOturum(eski, d);
    if (kilit && s.bitis < kilit) return `${tarihYaz(kilit)} tarihli dersin yoklaması veya iptali var; ders bu tarihten önce kapatılamaz.`;
    return null;
  }
  if (eski) {
    if (eski.baslangic < bugun) return "Başlamış ders satırı değiştirilemez; değişiklik yeni satırla belirtilen tarihten itibaren yapılır.";
    if (sonKilitliOturum(eski, d)) return "Yoklaması veya iptali olan ders satırı değiştirilemez.";
  }
  if (!tarihGecerli(s.baslangic)) return "Başlangıç tarihi hatalı.";
  if (s.baslangic < bugun) return "Ders geçmiş tarihten başlatılamaz.";
  const m = programSatirEngeli(s, eski, d, secenek);
  if (m) return m;
  const c = programCakismalari(s, d.program, d);
  if (c.length) return cakismaMesaji(c[0]);
  return yedekProgramCakisiyor(s, d) ? "Öğretmen bu saatte dolu." : null;
}

export function programSilmeEngeli(eski: ProgramSatiri, d: Kayitlar, bugun: string): Hata {
  if (eski.baslangic < bugun) return "Geçmişi olan ders silinemez; belirtilen tarihten itibaren kapatılır.";
  if (sonKilitliOturum(eski, d)) return "Yoklaması veya iptali olan ders silinemez.";
  return null;
}

/* ---------- Tatil ---------- */

export function tatilYazmaEngeli(t: Tatil, eski: Tatil | undefined, d: Pick<Db, "tatiller" | "subeler" | "yoklamalar" | "gruplar">, bugun: string): Hata {
  if (!tarihGecerli(t.tarih)) return "Tarih hatalı.";
  if (typeof t.ad !== "string" || !t.ad.trim()) return "Tatil adı boş olamaz.";
  if (t.subeId && !d.subeler.some((s) => s.id === t.subeId)) return "Şube bulunamadı.";
  if (t.tarih < bugun || (eski && eski.tarih < bugun)) return "Geçmiş tarihli tatil eklenemez veya değiştirilemez.";
  if (d.tatiller.some((x) => x.id !== t.id && x.tarih === t.tarih && (x.subeId ?? null) === (t.subeId ?? null))) return "Bu tarihte aynı kapsamda tatil zaten var.";
  const yoklamali = Object.values(d.yoklamalar ?? {}).some((y) => y.tarih === t.tarih && (!t.subeId || d.gruplar.find((g) => g.id === y.grupId)?.subeId === t.subeId));
  if (yoklamali) return "Bu tarihte yoklaması alınmış ders var; tatil eklenemez.";
  return null;
}

/** Geçmiş oturumların durumu (yoklama, hak ediş) sonradan değişmesin */
export function tatilSilmeEngeli(t: Tatil, bugun: string): Hata {
  return t.tarih < bugun ? "Geçmiş tarihli tatil kaldırılamaz." : null;
}

/* ---------- Tek seferlik iptal ve telafi ---------- */

export function iptalYazmaEngeli(i: Iptal, eski: Iptal | undefined, d: Pick<Db, "program" | "gruplar" | "tatiller" | "yoklamalar">, bugun: string): Hata {
  if (eski) return "Ders iptali sonradan değiştirilemez.";
  const k = oturumKimligi(i.oturumId);
  const p = k && d.program.find((x) => x.id === k.satirId);
  if (!k || !p || p.gun !== haftaGunu(k.tarih) || !satirGecerliMi(p, k.tarih)) return "İptal edilecek ders bulunamadı.";
  if (k.tarih < bugun) return "Geçmiş tarihli ders iptal edilemez.";
  if (typeof i.neden !== "string" || !i.neden.trim()) return "İptal nedeni yazılmalı.";
  if (d.yoklamalar?.[i.oturumId]) return "Yoklaması alınmış ders iptal edilemez.";
  const subeId = d.gruplar.find((g) => g.id === p.grupId)?.subeId;
  const tatilMi = (t: string) => d.tatiller.some((x) => x.tarih === t && (!x.subeId || x.subeId === subeId));
  if (tatilMi(k.tarih)) return "Bu tarih tatil; ders zaten yapılmıyor.";
  if (i.telafi !== undefined) {
    if (!tarihGecerli(i.telafi)) return "Telafi tarihi hatalı.";
    if (i.telafi < k.tarih) return "Telafi tarihi iptal edilen dersten önce olamaz.";
    if (tatilMi(i.telafi)) return "Telafi tarihi tatil gününe denk geliyor.";
  }
  return null;
}

/** Karar 2026-11-08: dersin tarihi geçmediyse (bugün dahil) ve yoklaması alınmadıysa iptal geri alınır */
export function iptalGeriAlmaEngeli(i: Iptal, d: Pick<Db, "yoklamalar">, bugun: string): Hata {
  const k = oturumKimligi(i.oturumId);
  if (!k) return "İptal edilen ders bulunamadı.";
  if (k.tarih < bugun) return "Tarihi geçmiş dersin iptali geri alınamaz.";
  if (d.yoklamalar?.[i.oturumId]) return "Yoklaması alınmış dersin iptali geri alınamaz.";
  return null;
}

/* ---------- Oturum bazlı yedek öğretmen (karar 2026-11-09) ---------- */

export type YedekVerisi = { yedekAtamalari?: YedekAtama[] };

export const oturumYedegi = (d: YedekVerisi, oturumId: string) => (d.yedekAtamalari ?? []).find((y) => y.oturumId === oturumId);

const ortusur = (a1: number, a2: number, b1: number, b2: number) => a1 < b2 && b1 < a2;

type CakismaVerisi = Tanimlar & Pick<Db, "program" | "iptaller" | "tatiller"> & YedekVerisi & { randevular?: Pick<Randevu, "ogretmenId" | "tarih" | "bas" | "bit" | "durum">[] };

/** O tarihte öğretmenin fiilen vereceği derslerin aralıkları: yedeğe devrettikleri girmez, yedek olarak aldıkları girer */
export function ogretmenGunAraliklari(d: CakismaVerisi, ogretmenId: string, tarih: string, haricOturum?: string): { bas: number; bit: number }[] {
  const gun = haftaGunu(tarih);
  const sonuc: { bas: number; bit: number }[] = [];
  for (const p of d.program) {
    if (p.gun !== gun || !satirGecerliMi(p, tarih)) continue;
    const oid = `${p.id}_${tarih}`;
    if (oid === haricOturum || (oturumYedegi(d, oid)?.ogretmenId ?? p.ogretmenId) !== ogretmenId || d.iptaller.some((i) => i.oturumId === oid)) continue;
    const s = satirSlotu(d, p);
    if (s && !d.tatiller.some((t) => t.tarih === tarih && (!t.subeId || t.subeId === s.subeId))) sonuc.push({ bas: s.bas, bit: s.bit });
  }
  return sonuc;
}

/** Etüt çakışması için: öğretmenin o tarihteki yedek görevleri */
export function yedekAraliklari(d: Tanimlar & Pick<Db, "program"> & YedekVerisi, ogretmenId: string, tarih: string): { bas: number; bit: number }[] {
  const sonuc: { bas: number; bit: number }[] = [];
  for (const y of d.yedekAtamalari ?? []) {
    const k = oturumKimligi(y.oturumId);
    const p = k && k.tarih === tarih && y.ogretmenId === ogretmenId ? d.program.find((x) => x.id === k.satirId) : undefined;
    const s = p && satirSlotu(d, p);
    if (s) sonuc.push({ bas: s.bas, bit: s.bit });
  }
  return sonuc;
}

/** Yeni program satırı, öğretmenin yürürlük içindeki yedek göreviyle çakışıyor mu */
function yedekProgramCakisiyor(s: ProgramSatiri, d: Tanimlar & Pick<Db, "program"> & YedekVerisi): boolean {
  const slot = satirSlotu(d, s);
  if (!slot) return false;
  return (d.yedekAtamalari ?? []).some((y) => {
    const k = oturumKimligi(y.oturumId);
    if (!k || y.ogretmenId !== s.ogretmenId || haftaGunu(k.tarih) !== s.gun || !satirGecerliMi(s, k.tarih)) return false;
    const p = d.program.find((x) => x.id === k.satirId);
    const o = p && satirSlotu(d, p);
    return !!o && ortusur(o.bas, o.bit, slot.bas, slot.bit);
  });
}

type YedekDenetimi = CakismaVerisi & Pick<Db, "personel" | "sezonlar" | "yoklamalar">;

/** Atama veya değiştirme. Branş dışı kuralı: atayan zaten yönetici olduğundan branş şartı aranmaz. */
export function yedekAtamaEngeli(y: Pick<YedekAtama, "oturumId" | "ogretmenId">, d: YedekDenetimi, bugun: string, rol: Rol): Hata {
  if (!bransDisiAtayabilir(rol)) return "Yedek öğretmeni yalnızca şube müdürü veya genel yönetici atar.";
  const k = oturumKimligi(y.oturumId);
  const p = k && d.program.find((x) => x.id === k.satirId);
  if (!k || !p || p.gun !== haftaGunu(k.tarih) || !satirGecerliMi(p, k.tarih)) return "Bu tarihte böyle bir ders yok.";
  const g = d.gruplar.find((x) => x.id === p.grupId);
  const h = d.dersSaatleri.find((x) => x.id === p.saatId);
  if (!g || !h) return "Bu tarihte böyle bir ders yok.";
  const sezon = d.sezonlar.find((z) => z.id === g.sezonId);
  if (sezon && k.tarih > sezon.bitis) return "Bu tarihte böyle bir ders yok.";
  if (k.tarih < bugun) return "Geçmiş tarihli derse yedek atanamaz.";
  if (d.yoklamalar?.[y.oturumId]) return "Yoklaması alınmış dersin yedeği değiştirilemez.";
  if (d.iptaller.some((i) => i.oturumId === y.oturumId)) return "İptal edilen derse yedek atanamaz.";
  if (d.tatiller.some((t) => t.tarih === k.tarih && (!t.subeId || t.subeId === g.subeId))) return "Bu tarih tatil; yedek atanamaz.";
  if (y.ogretmenId === p.ogretmenId) return "Yedek, dersin asıl öğretmeni olamaz.";
  const m = ogretmenUygunlukEngeli(y.ogretmenId, p.dersId, g.subeId, d.personel, true);
  if (m) return m;
  const bas = dakika(h.baslangic);
  const bit = dakika(h.bitis);
  if (ogretmenGunAraliklari(d, y.ogretmenId, k.tarih, y.oturumId).some((a) => ortusur(a.bas, a.bit, bas, bit))) return "Öğretmen bu saatte dolu.";
  if ((d.randevular ?? []).some((r) => r.ogretmenId === y.ogretmenId && r.tarih === k.tarih && r.durum !== "iptal" && ortusur(dakika(r.bas), dakika(r.bit), bas, bit))) return "Öğretmenin bu saatte etüt randevusu var.";
  return null;
}

export function yedekKaldirmaEngeli(oturumId: string, d: Pick<Db, "yoklamalar">, bugun: string, rol: Rol): Hata {
  if (!bransDisiAtayabilir(rol)) return "Yedek öğretmeni yalnızca şube müdürü veya genel yönetici değiştirir.";
  const k = oturumKimligi(oturumId);
  if (!k || k.tarih < bugun) return "Geçmiş tarihli dersin yedeği değiştirilemez.";
  return d.yoklamalar?.[oturumId] ? "Yoklaması alınmış dersin yedeği değiştirilemez." : null;
}

/**
 * Yedeğin geçici erişimi: gruba kalıcı erişim vermez (ogretmenGruplariHesapla değişmez).
 * Program ve grup etiketi yaklaşan görevler için, öğrenci listesi yalnızca dersin günü ve geç giriş penceresinde;
 * yoklaması alınmış geçmiş oturumda erişim biter.
 */
export function yedekErisimi(d: Pick<Db, "program" | "yoklamalar"> & YedekVerisi, personelId: string, bugun: string, pencereGun: number) {
  const sonuc = { satirlar: new Set<string>(), gruplar: new Set<string>(), listeGruplari: new Set<string>(), oturumlar: new Set<string>() };
  for (const y of d.yedekAtamalari ?? []) {
    const k = oturumKimligi(y.oturumId);
    const p = k && y.ogretmenId === personelId ? d.program.find((x) => x.id === k.satirId) : undefined;
    if (!k || !p || k.tarih < tarihEkle(bugun, -pencereGun) || (k.tarih < bugun && d.yoklamalar?.[y.oturumId])) continue;
    sonuc.satirlar.add(p.id);
    sonuc.gruplar.add(p.grupId);
    if (k.tarih > bugun) continue;
    sonuc.listeGruplari.add(p.grupId);
    sonuc.oturumlar.add(y.oturumId);
  }
  return sonuc;
}

/* ---------- Görünürlük (kararlar 2026-11-08) ---------- */

/** Öğretmenin grupları: bugün veya ileride geçerli satırı olan veya rehberi olduğu gruplar. Grubu devreden öğretmenin erişimi kesilir. */
export function ogretmenGruplariHesapla(d: Pick<Db, "program" | "gruplar">, personelId: string, bugun: string): Set<string> {
  return new Set([
    ...d.program.filter((p) => p.ogretmenId === personelId && (!p.bitis || p.bitis >= bugun)).map((p) => p.grupId),
    ...d.gruplar.filter((g) => g.rehberId === personelId).map((g) => g.id),
  ]);
}

/** Şube müdürüne, kapsamındaki öğretmenlerin diğer şubelerdeki dersleri: yalnızca gün ve saat (ders, grup, şube yok) */
export function doluSaatleriHesapla(d: Pick<Db, "program" | "gruplar" | "dersSaatleri" | "personel" | "sezonlar">, kapsam: Set<string>): DoluSaat[] {
  const sonuc: DoluSaat[] = [];
  for (const p of d.program) {
    const g = d.gruplar.find((x) => x.id === p.grupId);
    const h = d.dersSaatleri.find((x) => x.id === p.saatId);
    const ogretmen = d.personel.find((x) => x.id === p.ogretmenId);
    if (!g || !h || !ogretmen || kapsam.has(g.subeId) || !ogretmen.subeIds.some((s) => kapsam.has(s))) continue;
    const sezon = d.sezonlar.find((z) => z.id === g.sezonId);
    sonuc.push({ ogretmenId: p.ogretmenId, gun: p.gun, bas: h.baslangic, bit: h.bitis, baslangic: p.baslangic, bitis: p.bitis ?? sezon?.bitis ?? null });
  }
  return sonuc;
}

/* ---------- Sezon sonu (karar 2026-11-08) ---------- */

/** Sezonun gruplarındaki açık satırların sezon sonuyla kapatılmış halleri (yalnızca değişenler) */
export function sezonSatirlariniKapat(program: ProgramSatiri[], gruplar: Db["gruplar"], sezon: Pick<Sezon, "id" | "bitis">): ProgramSatiri[] {
  const idler = new Set(gruplar.filter((g) => g.sezonId === sezon.id).map((g) => g.id));
  return program.filter((p) => !p.bitis && idler.has(p.grupId) && p.baslangic <= sezon.bitis).map((p) => ({ ...p, bitis: sezon.bitis }));
}

/** Bitmiş sezonların açık satırları; kapandıktan sonra boş döner (tekrar çalışması bir şey değiştirmez) */
export function sezonuBitenSatirlar(d: Pick<Db, "program" | "gruplar" | "sezonlar">, bugun: string): ProgramSatiri[] {
  return d.sezonlar.filter((z) => z.bitis < bugun).flatMap((z) => sezonSatirlariniKapat(d.program, d.gruplar, z));
}
