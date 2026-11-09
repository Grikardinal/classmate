/**
 * Bölüm 13 · Personel ve öğretmen: saf iş kuralları.
 * Ekran (index.tsx ve alt dosyalar) ve sunucu (server/politika.ts · personelDenetle, okumaSuz) aynı kuralları kullanır.
 * Sunucu da içe aktardığı için burada yalnızca göreli içe aktarma kullanılır.
 * Hata dönen fonksiyonlar Türkçe mesaj, sorun yoksa null döndürür.
 * Testler: kurallar.test.ts, sunucu.test.ts
 */
import type { Db, Personel, ProgramSatiri, Randevu, Rol, Yoklama } from "../../data/model";
import { epostaGecerli, hakEdis, telefonNormalize } from "../../lib/kurallar";
import { ROL_SEVIYESI, epostaNormalize, rolAtamaEngeli, rolGecerli, type Hata } from "../02-kullanicilar/kurallar";
import { adTemizle } from "../03-on-kayit/kurallar";
import { kurusa, tutarGecerli } from "../05-finans/kurallar";
import { tarihGecerli } from "../06-ders-programi/kurallar";

export type Avans = Db["avanslar"][number];
export type HakedisDurumu = "onaylandi" | "odendi";

export const AD_UZUNLUK = 60;
export const EPOSTA_UZUNLUK = 120;
export const ACIKLAMA_UZUNLUK = 200;
export const UCRET_TIPLERI: Personel["ucretTipi"][] = ["sabit", "ders", "karma"];
/** Maaş / hak ediş tutarı içeren işlem kayıtları: hak ediş yetkisi olmayana gitmez */
const HAKEDIS_ISLEMLERI = new Set(["Hak ediş onayı", "Hak ediş ödemesi", "Avans", "Etüt ücreti"]);
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

type AtamaVerisi = Pick<Db, "program" | "randevular" | "gruplar">;

/** Pasife alma: açık dersi veya planlı etüdü olan öğretmen önce devredilmeli */
export function pasifeAlmaEngeli(personelId: string, d: AtamaVerisi, bugun: string): Hata {
  const n = acikProgram(d.program, personelId, bugun).length;
  if (n) return `Bu öğretmenin programda ${n} dersi var; pasife almadan önce dersleri başka öğretmene aktarın (Bölüm 06).`;
  const r = gelecekRandevular(d.randevular, personelId, bugun).length;
  if (r) return `Bu öğretmenin ${r} planlı etüt randevusu var; önce randevuları iptal edin veya taşıyın (Bölüm 09).`;
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

type HesapVerisi = Pick<Db, "yoklamalar" | "randevular" | "gruplar" | "iptaller" | "tatiller" | "avanslar" | "giderler"> & { kurum?: { etutDersUcreti?: number } };

export type SubeSatiri = { s: string; n: number; e: number };
export type HakEdisHesabi = {
  subeBazinda: SubeSatiri[];
  dersSayisi: number;
  etutSayisi: number;
  tutar: number;
  avans: number;
  odenecek: number;
  /** Şube → finansa yazılacak gider (avanslar düşülmüş) */
  dagilim: { subeId: string; tutar: number }[];
};

/** "İşlenen ders": yoklaması alınmış, iptal veya tatile denk gelmeyen kendi oturumu. Oturum kimliği tekil olduğundan bir ders iki kişiye sayılmaz. */
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

export function hakEdisHesabi(d: HesapVerisi, p: Personel, ay: string): HakEdisHesabi {
  const oturumlar = islenenOturumlar(d, p.id, ay);
  const etutler = d.randevular.filter((r) => r.ogretmenId === p.id && r.tarih.startsWith(ay) && etutSayilir(r));
  const etutUcreti = d.kurum?.etutDersUcreti ?? 0;
  const sayac = new Map<string, SubeSatiri>([[p.anaSubeId, { s: p.anaSubeId, n: 0, e: 0 }]]);
  const satir = (s: string) => sayac.get(s) ?? sayac.set(s, { s, n: 0, e: 0 }).get(s)!;
  for (const y of oturumlar) satir(d.gruplar.find((g) => g.id === y.grupId)?.subeId ?? p.anaSubeId).n++;
  for (const r of etutler) satir(r.subeId).e++;

  // Tutarlar kuruş tamsayısıyla: şube payları toplama tam eşittir
  const dersUcreti = p.ucretTipi === "sabit" ? 0 : p.dersUcreti;
  const paylar = new Map<string, number>();
  for (const x of sayac.values()) paylar.set(x.s, kurusa(hakEdis("ders", x.n, dersUcreti, 0)) + kurusa(x.e * etutUcreti));
  if (p.ucretTipi !== "ders") paylar.set(p.anaSubeId, paylar.get(p.anaSubeId)! + kurusa(p.sabitUcret));
  const tutarK = [...paylar.values()].reduce((t, x) => t + x, 0);

  // Avans gideri zaten kendi şubesine yazıldı: önce o şubenin payından düşülür, artarsa diğerlerinden
  const avanslar = gecerliAvanslar(d, p.id, ay);
  for (const a of avanslar) {
    let kalan = kurusa(a.tutar);
    for (const s of [a.subeId, ...paylar.keys()]) {
      const pay = paylar.get(s) ?? 0;
      const dus = Math.min(pay, kalan);
      if (dus > 0) paylar.set(s, pay - dus);
      kalan -= dus;
    }
  }
  const avansK = avanslar.reduce((t, a) => t + kurusa(a.tutar), 0);
  return {
    subeBazinda: [...sayac.values()].filter((x) => x.n > 0 || x.e > 0 || x.s === p.anaSubeId),
    dersSayisi: oturumlar.length,
    etutSayisi: etutler.length,
    tutar: tutarK / 100,
    avans: avansK / 100,
    odenecek: (tutarK - avansK) / 100,
    dagilim: [...paylar].filter(([, k]) => k > 0).map(([subeId, k]) => ({ subeId, tutar: k / 100 })),
  };
}

/** Pasif öğretmen ve işe başlamamış öğretmen için, o ayda dersi yoksa boş satır (ve sabit maaş) çıkmaz */
export function hakEdisteGorunur(p: Pick<Personel, "aktif" | "baslangic">, ay: string, h: Pick<HakEdisHesabi, "dersSayisi" | "etutSayisi">, durum?: HakedisDurumu): boolean {
  if (h.dersSayisi > 0 || h.etutSayisi > 0 || durum) return true;
  return p.aktif && p.baslangic.slice(0, 7) <= ay;
}

export const odemeAciklamasi = (p: Pick<Personel, "ad" | "soyad">, ay: string) => `${p.ad} ${p.soyad} ${ay} hak edişi`;

/* ---------- Onay ve ödeme ---------- */

export function hakedisAnahtari(k: string): { ay: string; personelId: string } | null {
  const m = /^(\d{4}-\d{2})_(.+)$/.exec(k);
  return m && ayGecerli(m[1]) ? { ay: m[1], personelId: m[2] } : null;
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
