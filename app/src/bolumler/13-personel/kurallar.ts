/**
 * Bölüm 13 · Personel ve öğretmen: saf iş kuralları.
 * Ekran (index.tsx ve alt dosyalar) ve sunucu (server/politika.ts · personelDenetle, okumaSuz) aynı kuralları kullanır.
 * Sunucu da içe aktardığı için burada yalnızca göreli içe aktarma kullanılır.
 * Hata dönen fonksiyonlar Türkçe mesaj, sorun yoksa null döndürür.
 * Testler: kurallar.test.ts, sunucu.test.ts
 */
import type { Db, DonmusHakedis, HakedisDegeri, HakedisDuzeltme, HakedisKaydi, HakedisimSatiri, Personel, ProgramSatiri, Randevu, Rol, Yoklama } from "../../data/model";
import { epostaGecerli, hakEdis, telefonNormalize } from "../../lib/kurallar";
import { ROL_SEVIYESI, epostaNormalize, rolAtamaEngeli, rolGecerli, type Hata } from "../02-kullanicilar/kurallar";
import { adTemizle } from "../03-on-kayit/kurallar";
import { kurusa, tutarGecerli } from "../05-finans/kurallar";
import { tarihGecerli } from "../06-ders-programi/kurallar";

export type Avans = Db["avanslar"][number];
export type HakedisDurumu = "onaylandi" | "odendi";
export type { HakedisKaydi };

export const AD_UZUNLUK = 60;
export const EPOSTA_UZUNLUK = 120;
export const ACIKLAMA_UZUNLUK = 200;
export const UCRET_TIPLERI: Personel["ucretTipi"][] = ["sabit", "ders", "karma"];
/** Maaş / hak ediş tutarı içeren işlem kayıtları: hak ediş yetkisi olmayana gitmez */
const HAKEDIS_ISLEMLERI = new Set(["Hak ediş onayı", "Hak ediş ödemesi", "Hak ediş düzeltmesi", "Avans", "Etüt ücreti"]);
export const hakedisIslemiMi = (islem: string) => HAKEDIS_ISLEMLERI.has(islem);
export const MAAS_KATEGORISI = "Maaş";
export const MASKELI_MAAS_ACIKLAMASI = "Personel ödemesi";

/* ---------- Kişisel ve ücret verisi ---------- */

export type Goren = { rol: Rol; personelId: string; yetki13: boolean };

/** Telefon, e-posta: genel yönetici, hak ediş / personel yetkisi olan ve kişinin kendisi */
export const iletisimGorur = (g: Goren, hedefId: string) => g.rol === "genel-yonetici" || g.yetki13 || g.personelId === hedefId;

/** Ücret: genel yönetici, kişinin kendisi ve 13 yetkili kişi yalnızca kendinden alt görevdekiler (müdür, başka müdürün veya yöneticinin ücretini görmez) */
export function ucretGorur(g: Goren, hedef: Pick<Personel, "id" | "gorev">): boolean {
  if (g.rol === "genel-yonetici" || g.personelId === hedef.id) return true;
  return g.yetki13 && ROL_SEVIYESI[hedef.gorev] < ROL_SEVIYESI[g.rol];
}

/** Sunucunun gönderdiği satır: görülemeyen alanlar boşaltılır. Yazarken eski değer geri konur (personelDenetle). */
export function personelMaskele<T extends Pick<Personel, "id" | "gorev">>(s: T, g: Goren): T {
  let sonuc: T = s;
  if (!iletisimGorur(g, s.id)) sonuc = { ...sonuc, telefon: "", eposta: "" };
  if (!ucretGorur(g, s)) sonuc = { ...sonuc, ucretTipi: "sabit", sabitUcret: 0, dersUcreti: 0 };
  return sonuc;
}

/** Maskeli gelen alanları eski değerle tamamlar; yeni satırda ücret yazılamaz */
export function maskeliAlanlariKoru(s: Personel, eski: Personel | undefined, g: Goren): Personel {
  if (!eski) return ucretGorur(g, s) ? s : { ...s, ucretTipi: "sabit", sabitUcret: 0, dersUcreti: 0 };
  let sonuc = s;
  if (!iletisimGorur(g, eski.id)) sonuc = { ...sonuc, telefon: eski.telefon, eposta: eski.eposta };
  if (!ucretGorur(g, eski)) sonuc = { ...sonuc, ucretTipi: eski.ucretTipi, sabitUcret: eski.sabitUcret, dersUcreti: eski.dersUcreti };
  return sonuc;
}

/* ---------- Dersleri olan öğretmen ---------- */

/** Bugün ve sonrasında yürürlükte olan program satırları */
export const acikProgram = (program: ProgramSatiri[], personelId: string, bugun: string) =>
  program.filter((p) => p.ogretmenId === personelId && (!p.bitis || p.bitis >= bugun));

export const gelecekRandevular = (randevular: Randevu[], personelId: string, bugun: string) =>
  randevular.filter((r) => r.ogretmenId === personelId && r.durum === "planli" && r.tarih >= bugun);

type AtamaVerisi = Pick<Db, "program" | "randevular" | "gruplar"> & { yedekAtamalari?: Db["yedekAtamalari"] };

/** Pasife alma: açık dersi veya planlı etüdü olan öğretmen önce devredilmeli */
export function pasifeAlmaEngeli(personelId: string, d: AtamaVerisi, bugun: string): Hata {
  const n = acikProgram(d.program, personelId, bugun).length;
  if (n) return `Bu öğretmenin programda ${n} dersi var; pasife almadan önce dersleri başka öğretmene aktarın (Bölüm 06).`;
  const r = gelecekRandevular(d.randevular, personelId, bugun).length;
  if (r) return `Bu öğretmenin ${r} planlı etüt randevusu var; önce randevuları iptal edin veya taşıyın (Bölüm 09).`;
  if ((d.yedekAtamalari ?? []).some((y) => y.ogretmenId === personelId && y.oturumId.slice(y.oturumId.lastIndexOf("_") + 1) >= bugun)) return "Bu öğretmenin yaklaşan yedek görevi var; önce yedeği değiştirin (Bölüm 06).";
  return null;
}

/** Görev değişimi ve şubeden çıkarma mevcut dersleri öğretmensiz bırakamaz */
export function atamaEngeli(s: Personel, eski: Personel, d: AtamaVerisi, bugun: string): Hata {
  if (eski.aktif && !s.aktif) {
    const h = pasifeAlmaEngeli(eski.id, d, bugun);
    if (h) return h;
  }
  const acik = acikProgram(d.program, eski.id, bugun);
  if (eski.gorev === "ogretmen" && s.gorev !== "ogretmen" && acik.length) return "Programda dersi olan öğretmenin görevi değiştirilemez; önce dersleri aktarın (Bölüm 06).";
  const cikan = eski.subeIds.filter((x) => !s.subeIds.includes(x));
  if (!cikan.length) return null;
  const grupSube = (grupId: string) => d.gruplar.find((g) => g.id === grupId)?.subeId;
  if (acik.some((p) => cikan.includes(grupSube(p.grupId) ?? "")) || gelecekRandevular(d.randevular, eski.id, bugun).some((r) => cikan.includes(r.subeId)))
    return "Bu şubede dersi veya planlı etüdü olan öğretmen şubeden çıkarılamaz; önce dersleri aktarın.";
  return null;
}

/* ---------- Personel kartı ---------- */

type KartVerisi = AtamaVerisi & Pick<Db, "personel" | "subeler" | "dersler">;

export function ucretEngeli(s: Pick<Personel, "ucretTipi" | "dersUcreti" | "sabitUcret">): Hata {
  if (!UCRET_TIPLERI.includes(s.ucretTipi)) return "Ücret tipi geçersiz.";
  if (!tutarGecerli(s.dersUcreti, { sifirOlur: true }) || !tutarGecerli(s.sabitUcret, { sifirOlur: true })) return "Ücret sıfır veya pozitif, kuruş hassasiyetinde olmalı.";
  return null;
}

/** Saklanacak biçim: ad boşlukları, tek telefon biçimi, küçük harf e-posta */
export function personelTemizle(s: Personel): Personel {
  return { ...s, ad: adTemizle(s.ad), soyad: adTemizle(s.soyad), telefon: telefonNormalize(s.telefon) ?? s.telefon, eposta: epostaNormalize(s.eposta) };
}

/**
 * Alan kuralları. Telefon, e-posta, tarih ve branş yalnızca yeni kayıtta veya değiştiyse denetlenir
 * (kurulumda oluşan telefonsuz yönetici kartı gibi eski kayıtlar kilitlenmesin).
 * `s` temizlenmiş olmalı (personelTemizle).
 */
export function personelDogrula(s: Personel, eski: Personel | undefined, d: Pick<KartVerisi, "personel" | "subeler" | "dersler">): Hata {
  if (!s || typeof s !== "object") return "Personel bilgisi geçersiz.";
  for (const [ad, deger] of [["Ad", s.ad], ["Soyad", s.soyad]] as const) {
    if (typeof deger !== "string" || !deger) return `${ad} boş olamaz.`;
    if (deger.length > AD_UZUNLUK) return `${ad} en fazla ${AD_UZUNLUK} karakter olabilir.`;
    if (!/\p{L}/u.test(deger)) return `${ad} harf içermeli.`;
  }
  if (!rolGecerli(s.gorev)) return "Geçersiz görev.";
  if (typeof s.aktif !== "boolean") return "Personel durumu geçersiz.";
  const digerleri = d.personel.filter((p) => p.id !== s.id);
  if (!eski || s.telefon !== eski.telefon) {
    if (!telefonNormalize(s.telefon)) return "Geçerli bir cep telefonu girin.";
    if (digerleri.some((p) => telefonNormalize(p.telefon) === telefonNormalize(s.telefon))) return "Bu telefonla kayıtlı başka bir personel var.";
  }
  if (s.eposta && (!eski || s.eposta !== eski.eposta)) {
    if (s.eposta.length > EPOSTA_UZUNLUK || !epostaGecerli(s.eposta)) return "Geçerli bir e-posta girin.";
    if (digerleri.some((p) => p.eposta && epostaNormalize(p.eposta) === s.eposta)) return "Bu e-postayla kayıtlı başka bir personel var.";
  }
  if (!Array.isArray(s.subeIds) || !s.subeIds.length) return "En az bir şube seçilmeli.";
  if (new Set(s.subeIds).size !== s.subeIds.length) return "Şube listesinde yinelenen şube var.";
  for (const id of s.subeIds) {
    const sube = d.subeler.find((x) => x.id === id);
    if (!sube) return "Şube listesinde tanımsız şube var.";
    if (!sube.aktif && !eski?.subeIds.includes(id)) return "Pasif şubeye personel atanamaz.";
  }
  if (!s.subeIds.includes(s.anaSubeId)) return "Ana şube bağlı şubelerden biri olmalı.";
  if (!Array.isArray(s.dersIds) || new Set(s.dersIds).size !== s.dersIds.length) return "Branş listesi geçersiz.";
  if (s.dersIds.some((id) => !eski?.dersIds.includes(id) && !d.dersler.some((x) => x.id === id))) return "Branş listesinde tanımsız ders var.";
  if ((!eski || s.baslangic !== eski.baslangic) && !tarihGecerli(s.baslangic)) return "İşe başlama tarihi geçersiz.";
  return ucretEngeli(s);
}

export type KartAktoru = { rol: Rol; personelId: string };

/** Görev ve kendi kartı kuralları: yetki yükseltme yok; kişi kendi görevini, şubesini, ücretini değiştiremez */
export function kartYetkiEngeli(s: Personel, eski: Personel | undefined, a: KartAktoru): Hata {
  const genel = a.rol === "genel-yonetici";
  if (!eski || eski.gorev !== s.gorev) {
    const h = rolAtamaEngeli(a.rol, s.gorev);
    if (h) return h;
  }
  if (!eski) return null;
  if (!genel && ROL_SEVIYESI[eski.gorev] > ROL_SEVIYESI[a.rol]) return "Kendinizden yetkili birinin kartını yönetme yetkiniz yok.";
  if (eski.id !== a.personelId) return null;
  if (eski.gorev !== s.gorev) return "Kendi görevinizi değiştiremezsiniz.";
  if (genel) return null;
  if (JSON.stringify(eski.subeIds) !== JSON.stringify(s.subeIds) || eski.anaSubeId !== s.anaSubeId) return "Kendi şube atamanızı değiştiremezsiniz.";
  if (eski.ucretTipi !== s.ucretTipi || eski.dersUcreti !== s.dersUcreti || eski.sabitUcret !== s.sabitUcret) return "Kendi ücret bilginizi değiştiremezsiniz.";
  return null;
}

/** Ekran ve sunucu aynı kararı verir. `s` temizlenmiş olmalı. */
export function personelYazmaEngeli(s: Personel, eski: Personel | undefined, d: KartVerisi, a: KartAktoru, bugun: string): Hata {
  return personelDogrula(s, eski, d) ?? kartYetkiEngeli(s, eski, a) ?? (eski ? atamaEngeli(s, eski, d, bugun) : null);
}

/** Yalnızca içe aktarmanın geri alınmasında silinir: bağlı hiçbir iş kaydı olmamalı */
export function personelSilmeEngeli(id: string, d: AtamaVerisi & Pick<Db, "yoklamalar" | "musaitlikler" | "avanslar" | "hakedisDurum" | "odevler">): Hata {
  const bagli =
    d.program.some((p) => p.ogretmenId === id) ||
    (d.yedekAtamalari ?? []).some((y) => y.ogretmenId === id) ||
    Object.values(d.yoklamalar).some((y) => y.ogretmenId === id) ||
    d.randevular.some((r) => r.ogretmenId === id) ||
    d.musaitlikler.some((m) => m.ogretmenId === id) ||
    d.avanslar.some((a) => a.personelId === id) ||
    d.gruplar.some((g) => g.rehberId === id) ||
    d.odevler.some((o) => o.ogretmenId === id) ||
    Object.keys(d.hakedisDurum).some((k) => hakedisAnahtari(k)?.personelId === id);
  return bagli ? "Bu personele bağlı ders, yoklama veya ödeme kaydı var; silinemez, pasife alın." : null;
}

/* ---------- Ay ---------- */

export const ayGecerli = (ay: unknown): ay is string => typeof ay === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(ay);

const ayGeri = (ay: string, n: number) => {
  const [y, a] = ay.split("-").map(Number);
  const t = y * 12 + (a - 1) - n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
};

/** Seçilebilir aylar (yeniden eskiye): son 12 ay + verisi olan eski aylar; gelecek ay yok */
export function hakedisAylari(d: Pick<Db, "yoklamalar" | "randevular" | "hakedisDurum">, bugun: string): string[] {
  const buAy = bugun.slice(0, 7);
  const aylar = new Set(Array.from({ length: 12 }, (_, i) => ayGeri(buAy, i)));
  for (const y of Object.values(d.yoklamalar)) aylar.add(y.tarih.slice(0, 7));
  for (const r of d.randevular) if (r.durum === "yapildi") aylar.add(r.tarih.slice(0, 7));
  for (const k of Object.keys(d.hakedisDurum)) aylar.add(k.slice(0, 7));
  return [...aylar].filter((a) => ayGecerli(a) && a <= buAy).sort().reverse();
}

/* ---------- Hak ediş hesabı ---------- */

/** Karar 2026-11-08: yalnızca "yapıldı" randevu; öğrenci sonucu varsa en az bir öğrenci gelmiş olmalı. Düzeltme durumu değiştirdiği için hesaba kendiliğinden yansır. */
export function etutSayilir(r: Pick<Randevu, "durum" | "sonuclar">): boolean {
  if (r.durum !== "yapildi") return false;
  return r.sonuclar ? Object.values(r.sonuclar).includes("yapildi") : true;
}

export function etutUcretiEngeli(u: unknown): Hata {
  if (u === undefined) return null;
  return tutarGecerli(u, { sifirOlur: true }) ? null : "Etüt ders ücreti sıfır veya pozitif, kuruş hassasiyetinde olmalı.";
}

type HesapVerisi = Pick<Db, "yoklamalar" | "randevular" | "gruplar" | "iptaller" | "tatiller" | "avanslar" | "giderler"> & { kurum?: { etutDersUcreti?: number }; hakedisDurum?: Db["hakedisDurum"] };

export type SubeSatiri = { s: string; n: number; e: number };
export type HakEdisHesabi = {
  subeBazinda: SubeSatiri[];
  dersSayisi: number;
  etutSayisi: number;
  birimDers: number;
  birimEtut: number;
  /** Ayın kendi hak edişi (elle düzeltme dahil; önceki ay farkı hariç) */
  tutar: number;
  duzeltme: number;
  oncekiFark: number;
  farkKaynak: { ay: string; tutar: number }[];
  avans: number;
  devredenAvans: number;
  /** Bu ayın hak edişini aşıp sonraki aya taşınan avans */
  fazlaAvans: number;
  odenecek: number;
  /** Şube → finansa yazılacak gider (avanslar düşülmüş) */
  dagilim: { subeId: string; tutar: number }[];
  /** Ödenmiş ayda dondurulan tutarlar gösteriliyor */
  donduruldu: boolean;
};

/** Eski kayıt düz metin, yeni kayıt nesne: tek biçime çevirir */
export function hakedisKaydi(v: HakedisDegeri | undefined): HakedisKaydi {
  if (!v) return {};
  return typeof v === "string" ? { durum: v } : v;
}

const ayIleri = (ay: string) => ayGeri(ay, -1);
const kaydi = (d: HesapVerisi, personelId: string, ay: string) => hakedisKaydi(d.hakedisDurum?.[`${ay}_${personelId}`]);

/** "İşlenen ders": yoklaması alınmış, iptal veya tatile denk gelmeyen kendi oturumu. Oturum kimliği tekil olduğundan bir ders iki kişiye sayılmaz. Yedek varsa yoklamadaki öğretmen yedektir. */
export function islenenOturumlar(d: Pick<HesapVerisi, "yoklamalar" | "gruplar" | "iptaller" | "tatiller">, personelId: string, ay: string): Yoklama[] {
  return Object.values(d.yoklamalar).filter((y) => {
    if (y.ogretmenId !== personelId || !y.tarih.startsWith(ay)) return false;
    if (d.iptaller.some((i) => i.oturumId === y.oturumId)) return false;
    const subeId = d.gruplar.find((g) => g.id === y.grupId)?.subeId;
    return !d.tatiller.some((t) => t.tarih === y.tarih && (!t.subeId || t.subeId === subeId));
  });
}

/** Finans gideri iptal edilen avans düşülmez */
export function gecerliAvanslar(d: Pick<HesapVerisi, "avanslar" | "giderler">, personelId: string, ay: string): Avans[] {
  return d.avanslar.filter((a) => a.personelId === personelId && a.tarih.startsWith(ay) && !d.giderler.find((g) => g.id === a.giderId)?.iptal);
}

function bazHesap(d: HesapVerisi, p: Personel, ay: string) {
  const oturumlar = islenenOturumlar(d, p.id, ay);
  const etutler = d.randevular.filter((r) => r.ogretmenId === p.id && r.tarih.startsWith(ay) && etutSayilir(r));
  const birimEtut = d.kurum?.etutDersUcreti ?? 0;
  const birimDers = p.ucretTipi === "sabit" ? 0 : p.dersUcreti;
  const sayac = new Map<string, SubeSatiri>([[p.anaSubeId, { s: p.anaSubeId, n: 0, e: 0 }]]);
  const satir = (s: string) => sayac.get(s) ?? sayac.set(s, { s, n: 0, e: 0 }).get(s)!;
  for (const y of oturumlar) satir(d.gruplar.find((g) => g.id === y.grupId)?.subeId ?? p.anaSubeId).n++;
  for (const r of etutler) satir(r.subeId).e++;
  // Tutarlar kuruş tamsayısıyla: şube payları toplama tam eşittir
  const paylar = new Map<string, number>();
  for (const x of sayac.values()) paylar.set(x.s, kurusa(hakEdis("ders", x.n, birimDers, 0)) + kurusa(x.e * birimEtut));
  if (p.ucretTipi !== "ders") paylar.set(p.anaSubeId, paylar.get(p.anaSubeId)! + kurusa(p.sabitUcret));
  return { sayac, paylar, dersSayisi: oturumlar.length, etutSayisi: etutler.length, birimDers, birimEtut };
}

/** Ödenmiş ayın henüz taşınmamış farkı (kuruş). Dondurulmamış eski ödenmiş satırda fark hesaplanmaz; ücret değişimi fark doğurmaz (ödeme anındaki birim). */
function ayFarkiK(d: HesapVerisi, p: Personel, ay: string): number {
  const { durum, donmus: m } = kaydi(d, p.id, ay);
  if (durum !== "odendi" || !m) return 0;
  const b = bazHesap(d, p, ay);
  return kurusa((b.dersSayisi - m.dersSayisi) * m.birimDers) + kurusa((b.etutSayisi - m.etutSayisi) * m.birimEtut) - kurusa(m.aktarilan);
}

/** Bu aya girecek farklar: kaynağı ödenmiş, ondan sonraki ilk ödenmemiş ay bu ay olanlar. Fark tek bir aya girer. */
function oncekiFarklar(d: HesapVerisi, p: Personel, ay: string): { ay: string; tutar: number }[] {
  const sonuc: { ay: string; tutar: number }[] = [];
  for (const k of Object.keys(d.hakedisDurum ?? {})) {
    const an = hakedisAnahtari(k);
    if (!an || an.personelId !== p.id || an.ay >= ay) continue;
    let sonraki = ayIleri(an.ay);
    while (kaydi(d, p.id, sonraki).durum === "odendi") sonraki = ayIleri(sonraki);
    if (sonraki !== ay) continue;
    const f = ayFarkiK(d, p, an.ay);
    if (f) sonuc.push({ ay: an.ay, tutar: f / 100 });
  }
  return sonuc.sort((a, b) => a.ay.localeCompare(b.ay));
}

function canliHesap(d: HesapVerisi, p: Personel, ay: string, devirK: number): HakEdisHesabi {
  const b = bazHesap(d, p, ay);
  const paylar = new Map(b.paylar);
  const ana = p.anaSubeId;
  const bazK = [...paylar.values()].reduce((t, x) => t + x, 0);
  const duzeltmeK = kurusa(kaydi(d, p.id, ay).duzeltme?.tutar ?? 0);
  const farkKaynak = oncekiFarklar(d, p, ay);
  const farkK = farkKaynak.reduce((t, f) => t + kurusa(f.tutar), 0);
  // Pozitif düzeltme ve fark ana şubeye eklenir; negatifler kesinti gibi işlenir
  for (const x of [duzeltmeK, farkK]) if (x > 0) paylar.set(ana, paylar.get(ana)! + x);
  const avanslar = gecerliAvanslar(d, p.id, ay);
  // Avans gideri zaten kendi şubesine yazıldı: önce o şubenin payından düşülür, artarsa diğerlerinden
  const kesintiler = [
    ...avanslar.map((a) => ({ s: a.subeId, k: kurusa(a.tutar) })),
    { s: ana, k: devirK },
    { s: ana, k: Math.max(0, -duzeltmeK) },
    { s: ana, k: Math.max(0, -farkK) },
  ];
  let fazlaK = 0;
  for (const x of kesintiler) {
    let kalan = x.k;
    for (const s of [x.s, ...paylar.keys()]) {
      const pay = paylar.get(s) ?? 0;
      const dus = Math.min(pay, kalan);
      if (dus > 0) paylar.set(s, pay - dus);
      kalan -= dus;
    }
    fazlaK += kalan;
  }
  const dagilim = [...paylar].filter(([, k]) => k > 0).map(([subeId, k]) => ({ subeId, tutar: k / 100 }));
  return {
    subeBazinda: [...b.sayac.values()].filter((x) => x.n > 0 || x.e > 0 || x.s === ana),
    dersSayisi: b.dersSayisi,
    etutSayisi: b.etutSayisi,
    birimDers: b.birimDers,
    birimEtut: b.birimEtut,
    tutar: (bazK + duzeltmeK) / 100,
    duzeltme: duzeltmeK / 100,
    oncekiFark: farkK / 100,
    farkKaynak,
    avans: avanslar.reduce((t, a) => t + kurusa(a.tutar), 0) / 100,
    devredenAvans: devirK / 100,
    fazlaAvans: fazlaK / 100,
    odenecek: dagilim.reduce((t, x) => t + kurusa(x.tutar), 0) / 100,
    dagilim,
    donduruldu: false,
  };
}

/** Bu aya devreden fazla avans (kuruş): geçmiş aylar sırayla katlanır; dondurulmuş ayda dondurulan devir esas alınır */
function devredenAvansK(d: HesapVerisi, p: Personel, ay: string): number {
  const durumAylari = Object.keys(d.hakedisDurum ?? {}).map(hakedisAnahtari).filter((k) => k?.personelId === p.id).map((k) => k!.ay);
  const avansAylari = d.avanslar.filter((a) => a.personelId === p.id).map((a) => a.tarih.slice(0, 7));
  const ilgili = new Set([...durumAylari, ...avansAylari].filter((a) => a < ay));
  if (!ilgili.size) return 0;
  let kalan = 0;
  for (let a = [...ilgili].sort()[0]; a < ay; a = ayIleri(a)) {
    const k = kaydi(d, p.id, a);
    if (k.durum === "odendi" && k.donmus) kalan = kurusa(k.donmus.fazlaAvans);
    else if (kalan > 0 || ilgili.has(a)) kalan = kurusa(canliHesap(d, p, a, kalan).fazlaAvans);
  }
  return kalan;
}

export function hakEdisHesabi(d: HesapVerisi, p: Personel, ay: string): HakEdisHesabi {
  const k = kaydi(d, p.id, ay);
  const canli = canliHesap(d, p, ay, k.durum === "odendi" && k.donmus ? 0 : devredenAvansK(d, p, ay));
  if (k.durum !== "odendi" || !k.donmus) return canli;
  const m = k.donmus;
  return { ...canli, dersSayisi: m.dersSayisi, etutSayisi: m.etutSayisi, birimDers: m.birimDers, birimEtut: m.birimEtut, tutar: m.tutar, duzeltme: k.duzeltme?.tutar ?? 0, oncekiFark: m.oncekiFark, farkKaynak: m.farkKaynak, avans: m.avans, devredenAvans: m.devredenAvans, fazlaAvans: m.fazlaAvans, odenecek: m.odenecek, dagilim: [], donduruldu: true };
}

/** Sunucu ödeme anında yazar */
export function donmusOlustur(h: HakEdisHesabi, giderIds: string[]): DonmusHakedis {
  return { tutar: h.tutar, dersSayisi: h.dersSayisi, etutSayisi: h.etutSayisi, birimDers: h.birimDers, birimEtut: h.birimEtut, avans: h.avans, devredenAvans: h.devredenAvans, fazlaAvans: h.fazlaAvans, oncekiFark: h.oncekiFark, odenecek: h.odenecek, farkKaynak: h.farkKaynak, aktarilan: 0, giderIds };
}

/** Kaynak ayın taşınan farkını işler (ödemede +, ödeme iptalinde −); fark iki kez sayılmaz */
export function farkAktar(v: HakedisDegeri | undefined, tutar: number): HakedisDegeri {
  const r = hakedisKaydi(v);
  return r.donmus ? { ...r, donmus: { ...r.donmus, aktarilan: (kurusa(r.donmus.aktarilan) + kurusa(tutar)) / 100 } } : r;
}

/** Pasif öğretmen ve işe başlamamış öğretmen için, o ayda hareketi yoksa boş satır (ve sabit maaş) çıkmaz; kalan devir görünür kalır */
export function hakEdisteGorunur(p: Pick<Personel, "aktif" | "baslangic">, ay: string, h: Pick<HakEdisHesabi, "dersSayisi" | "etutSayisi"> & Partial<HakEdisHesabi>, durum?: HakedisDurumu): boolean {
  if (h.dersSayisi > 0 || h.etutSayisi > 0 || durum || h.devredenAvans || h.oncekiFark || h.duzeltme || h.avans) return true;
  return p.aktif && p.baslangic.slice(0, 7) <= ay;
}

/** Öğretmenin kendi dökümü. Finans kapalıyken yalnızca ders sayıları gider. */
export function hakedisimOzeti(d: HesapVerisi, p: Personel, bugun: string, finansAcik: boolean): HakedisimSatiri[] {
  const aylar = hakedisAylari({ yoklamalar: d.yoklamalar, randevular: d.randevular, hakedisDurum: d.hakedisDurum ?? {} }, bugun);
  const sonuc: HakedisimSatiri[] = [];
  for (const ay of aylar) {
    const h = hakEdisHesabi(d, p, ay);
    const k = kaydi(d, p.id, ay);
    if (!hakEdisteGorunur(p, ay, h, k.durum)) continue;
    const para = (n: number) => (finansAcik ? n : 0);
    sonuc.push({ ay, durum: k.durum ?? "bekliyor", dersSayisi: h.dersSayisi, etutSayisi: h.etutSayisi, tutar: para(h.tutar), avans: para(h.avans), devredenAvans: para(h.devredenAvans), fazlaAvans: para(h.fazlaAvans), oncekiFark: para(h.oncekiFark), duzeltme: para(h.duzeltme), duzeltmeNeden: finansAcik ? (k.duzeltme?.neden ?? "") : "", odenecek: para(h.odenecek) });
  }
  return sonuc;
}

export const odemeAciklamasi = (p: Pick<Personel, "ad" | "soyad">, ay: string) => `${p.ad} ${p.soyad} ${ay} hak edişi`;

/* ---------- Onay ve ödeme ---------- */

export function hakedisAnahtari(k: string): { ay: string; personelId: string } | null {
  const m = /^(\d{4}-\d{2})_(.+)$/.exec(k);
  return m && ayGecerli(m[1]) ? { ay: m[1], personelId: m[2] } : null;
}

/** Elle düzeltme (karar 2026-11-09): yönetici, tam kapsamda; ödenmiş ayda yapılamaz; işaretli tutar */
export function hakedisDuzeltmeEngeli(anahtar: string, yeni: Pick<HakedisDuzeltme, "tutar" | "neden"> | undefined, eski: HakedisKaydi, b: DurumBaglami): Hata {
  const k = hakedisAnahtari(anahtar);
  if (!k || !b.personel.some((p) => p.id === k.personelId && p.gorev === "ogretmen")) return "Hak ediş kaydı geçersiz.";
  if (!b.hakedisAcik || !b.finansAcik) return "Hak ediş ve Finans modülleri açık olmalı.";
  if (b.rol !== "genel-yonetici" && !(b.rol === "sube-muduru" && b.tamKapsam)) return "Hak edişi yalnızca yönetici düzeltir; başka şubede de çalışan öğretmende genel yönetici.";
  if (eski.durum === "odendi") return "Ödenmiş ayda düzeltme yapılamaz.";
  if (k.ay > b.bugun.slice(0, 7)) return "Gelecek ay düzeltilemez.";
  if (!yeni) return null;
  if (typeof yeni.tutar !== "number" || !tutarGecerli(Math.abs(yeni.tutar))) return "Düzeltme tutarı sıfırdan farklı, kuruş hassasiyetinde olmalı.";
  const neden = typeof yeni.neden === "string" ? yeni.neden.trim() : "";
  if (neden.length < 3) return "Düzeltme gerekçesi en az 3 karakter olmalı.";
  if (neden.length > ACIKLAMA_UZUNLUK) return `Gerekçe en fazla ${ACIKLAMA_UZUNLUK} karakter olabilir.`;
  return null;
}

export type DurumBaglami = {
  hakedisAcik: boolean;
  finansAcik: boolean;
  rol: Rol;
  bugun: string;
  /** Öğretmenin bütün şubeleri aktörün kapsamında mı (eksik veriyle onay verilmesin) */
  tamKapsam: boolean;
  personel: Pick<Personel, "id" | "gorev">[];
};

export const ayBittiMi = (ay: string, bugun: string) => ay < bugun.slice(0, 7);

/** Durum akışı: (yok) → onaylandi → odendi. Geri dönüş yok; ödemeyi yalnızca genel yönetici işaretler. */
export function hakedisDurumEngeli(anahtar: string, yeni: unknown, eski: HakedisDurumu | undefined, b: DurumBaglami): Hata {
  const k = hakedisAnahtari(anahtar);
  if (!k || !b.personel.some((p) => p.id === k.personelId && p.gorev === "ogretmen")) return "Hak ediş kaydı geçersiz.";
  if (!b.hakedisAcik || !b.finansAcik) return "Hak ediş ve Finans modülleri açık olmalı.";
  if (yeni !== "onaylandi" && yeni !== "odendi") return "Hak ediş durumu geçersiz.";
  if (!ayBittiMi(k.ay, b.bugun)) return "Ay bitmeden hak ediş onaylanamaz.";
  if (eski === "odendi") return "Ödenmiş hak ediş değiştirilemez.";
  if (yeni === "onaylandi") {
    if (eski) return "Hak ediş zaten onaylı.";
    if (b.rol !== "genel-yonetici" && b.rol !== "sube-muduru") return "Hak edişi yalnızca yönetici onaylar.";
    return b.tamKapsam ? null : "Başka şubede de çalışan öğretmenin hak edişini genel yönetici onaylar.";
  }
  if (eski !== "onaylandi") return "Önce hak ediş onaylanmalı.";
  return b.rol === "genel-yonetici" ? null : "Ödemeyi yalnızca genel yönetici işaretler.";
}

/* ---------- Avans ---------- */

export function avansEngeli(a: Avans, p: Pick<Personel, "gorev" | "aktif" | "anaSubeId"> | undefined, b: { hakedisAcik: boolean; finansAcik: boolean; tamKapsam: boolean }): Hata {
  if (!b.hakedisAcik || !b.finansAcik) return "Hak ediş ve Finans modülleri açık olmalı.";
  if (!p || p.gorev !== "ogretmen") return "Avans yalnızca öğretmene verilir.";
  if (!p.aktif) return "Pasif personele avans verilemez.";
  if (!b.tamKapsam) return "Başka şubede de çalışan öğretmene avansı genel yönetici verir.";
  if (!tutarGecerli(a.tutar)) return "Avans tutarı sıfırdan büyük, kuruş hassasiyetinde olmalı.";
  if (a.subeId !== p.anaSubeId) return "Avans öğretmenin ana şubesine yazılır.";
  if (typeof a.aciklama !== "string" || a.aciklama.length > ACIKLAMA_UZUNLUK) return `Açıklama en fazla ${ACIKLAMA_UZUNLUK} karakter olabilir.`;
  return null;
}
