/**
 * Veri modeli: tipler, örnek veri üretimi ve saf yardımcılar.
 * Hem tarayıcı (src/data/store.ts) hem sunucu (server/) bu dosyayı kullanır; React veya tarayıcı API'si içermez.
 * Tüm örnek kişiler uydurmadır.
 */
import * as m from "./mock";
import {
  dakika,
  haftaGunu,
  isoTarih,
  kanalSec,
  sablonDoldur,
  smsBoyu,
  sozlesmeNo,
  tarihEkle,
  taksitPlani,
  telefonNormalize,
  type VarsayilanKanal,
  type YoklamaDurumu,
} from "../lib/kurallar";

/* =========================== Zaman =========================== */
function suankiZaman() {
  const d = new Date();
  return { tarih: isoTarih(d), saat: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` };
}
/** Bugünün tarihi (YYYY-MM-DD) ve saati (HH:MM). Canlı bağlama: her dakika güncellenir. */
export let BUGUN = suankiZaman().tarih;
export let SIMDI = suankiZaman().saat;
export function zamaniGuncelle() {
  const z = suankiZaman();
  BUGUN = z.tarih;
  SIMDI = z.saat;
}
if (typeof setInterval !== "undefined") {
  const t = setInterval(zamaniGuncelle, 30_000) as unknown as { unref?: () => void };
  t.unref?.();
}

/** Aktif sezon kimliği — tanımlar yüklenince güncellenir (Bölüm 01'de değiştirilebilir) */
export let AKTIF_SEZON = "z2";

/* =========================== Modüller =========================== */
export type ModulKey = "finans" | "hakedis" | "onKayit" | "odev" | "etut" | "mesajlasma";
export const varsayilanModuller: Record<ModulKey, boolean> = {
  finans: false,
  hakedis: false,
  onKayit: true,
  odev: true,
  etut: true,
  mesajlasma: false,
};

export type Kurum = { ad: string; eposta: string; vergiNo: string; makbuzBasligi: string; logo?: string };
export type { Sube, Sezon, Ders, Derslik, DersSaati, Grup } from "./mock";

/* =========================== Tipler =========================== */
export type Rol = "genel-yonetici" | "sube-muduru" | "sekreter" | "ogretmen";
export const rolAdlari: Record<Rol, string> = {
  "genel-yonetici": "Genel yönetici",
  "sube-muduru": "Şube müdürü",
  sekreter: "Sekreter / Kayıt",
  ogretmen: "Öğretmen",
};

export type Personel = {
  id: string;
  ad: string;
  soyad: string;
  gorev: Rol;
  telefon: string;
  eposta: string;
  subeIds: string[];
  anaSubeId: string;
  dersIds: string[];
  baslangic: string;
  aktif: boolean;
  ucretTipi: "sabit" | "ders" | "karma";
  dersUcreti: number;
  sabitUcret: number;
  iceAktarmaId?: string;
};

export type Kullanici = {
  id: string;
  personelId: string;
  rol: Rol;
  /** "all" = tüm şubeler */
  subeIds: string[] | "all";
  eposta: string;
  aktif: boolean;
  sonGiris: string | null;
  ikiAdim: boolean;
};

export type GirisKaydi = { id: string; kullaniciId: string; tarih: string; cihaz: string; basarili: boolean };

export type Veli = {
  id: string;
  ad: string;
  soyad: string;
  telefon: string;
  eposta: string;
  yakinlik: "Anne" | "Baba" | "Diğer";
  pushAcik: boolean;
  portalDavet: "gonderildi" | "giris-yapti" | "bekliyor";
  izinSms: boolean;
  izinTanitim: boolean;
};

export type Ogrenci = {
  id: string;
  ad: string;
  soyad: string;
  dogum: string;
  cinsiyet: "K" | "E";
  okul: string;
  okulSinifi: string;
  saglikNotu: string;
  veliIds: string[];
  birincilVeliId: string;
  durum: "aktif" | "ayrildi";
  notlar: { tarih: string; yazar: string; metin: string }[];
  iceAktarmaId?: string;
};

export type Kayit = {
  id: string;
  ogrenciId: string;
  sezonId: string;
  subeId: string;
  grupId: string;
  sozlesmeNo: string;
  durum: "aktif" | "dondurulmus" | "iptal";
  tarih: string;
  grupGecmisi: { grupId: string; tarih: string }[];
  ekHizmetler: string[];
  kvkkOnay: { tarih: string; surum: string } | null;
  listeFiyati: number;
  indirimler: { ad: string; oran: number }[];
  net: number;
  iceAktarmaId?: string;
};

export type ProgramSatiri = {
  id: string;
  grupId: string;
  gun: number;
  saatId: string;
  dersId: string;
  ogretmenId: string;
  derslikId: string;
  baslangic: string;
  bitis: string | null;
};

export type Tatil = { id: string; tarih: string; ad: string; subeId: string | null };
export type Iptal = { oturumId: string; neden: string; tarih: string; telafi?: string };

export type Yoklama = {
  oturumId: string;
  tarih: string;
  satirId: string;
  grupId: string;
  ogretmenId: string;
  durumlar: Record<string, YoklamaDurumu>;
  konu: string;
  kayitZamani: string;
};

export type Izin = { id: string; ogrenciId: string; tarih: string; not: string; veliId: string; olusturma: string };

export type AdayDurum = "yeni" | "gorusuldu" | "deneme" | "dusunuyor" | "kayit" | "vazgecti";
export type Aday = {
  id: string;
  veliAd: string;
  veliTelefon: string;
  ogrenciAd: string;
  seviye: number;
  okul: string;
  subeId: string;
  sorumluId: string;
  kaynak: string;
  durum: AdayDurum;
  sonrakiAksiyon: string | null;
  denemeTarihi: string | null;
  olusturma: string;
  notlar: { tarih: string; yazar: string; metin: string }[];
  vazgecmeNedeni: string | null;
  teklif: number | null;
  rizaVar: boolean;
  ogrenciId?: string;
};

export type TeslimDurumu = "yapti" | "eksik" | "yapmadi";
export type Odev = {
  id: string;
  ogretmenId: string;
  dersId: string;
  grupId: string;
  ogrenciIds: string[] | null;
  baslik: string;
  aciklama: string;
  kaynak: string;
  verilis: string;
  teslim: string;
  teslimler: Record<string, TeslimDurumu>;
  notlar: Record<string, string>;
  kontrolEdildi: boolean;
};

export type Musaitlik = { id: string; ogretmenId: string; subeId: string; gun: number; bas: string; bit: string };
export type EtutTuru = "bireysel" | "grup" | "online" | "ozel";
export type Randevu = {
  id: string;
  ogretmenId: string;
  subeId: string;
  tarih: string;
  bas: string;
  bit: string;
  tur: EtutTuru;
  ogrenciIds: string[];
  dersId: string;
  durum: "planli" | "yapildi" | "iptal" | "gelmedi";
  link: string;
  paketId: string | null;
  olusturan: "yonetim" | "veli";
};
export type Paket = { id: string; ogrenciId: string; ogretmenId: string; dersId: string; toplam: number; kalan: number; fiyat: number; tarih: string };

export type OlayKey =
  | "devamsizlik"
  | "dersIptal"
  | "hosgeldin"
  | "yeniOdev"
  | "odevYapmadi"
  | "odevHatirlatma"
  | "etutHatirlatma"
  | "duyuru"
  | "taksitHatirlatma"
  | "gecikmisOdeme"
  | "odemeAlindi"
  | "onKayitTesekkur";

export type BildirimOlayi = {
  key: OlayKey;
  ad: string;
  kanal: VarsayilanKanal;
  aktif: boolean;
  sablon: string;
  finans?: boolean;
  modul?: "odev" | "etut" | "onKayit";
};

export type Gonderim = {
  id: string;
  zaman: string;
  olay: OlayKey | "otp";
  veliId: string | null;
  alici: string;
  ogrenciId: string | null;
  subeId: string;
  kanal: "push" | "sms";
  metin: string;
  /** bekliyor: sunucu gönderim kuyruğunda; iletildi/basarisiz: sağlayıcı yanıtı */
  durum: "bekliyor" | "iletildi" | "basarisiz" | "okundu";
  hata?: string;
  maliyet: number;
};

export type Duyuru = {
  id: string;
  baslik: string;
  metin: string;
  hedef: { tur: "tum" | "sube" | "seviye" | "grup"; deger: string | null };
  kanal: "push" | "push+sms";
  zaman: string;
  zamanlanmis: boolean;
  gonderen: string;
  aliciVeliIds: string[];
  okuyanVeliIds: string[];
};

export type Taksit = { id: string; kayitId: string; ogrenciId: string; veliId: string; subeId: string; no: number; vade: string; tutar: number; odenen: number };
export type Tahsilat = {
  id: string;
  makbuzNo: string;
  zaman: string;
  veliId: string;
  subeId: string;
  alinanSubeId: string;
  tutar: number;
  yontem: "nakit" | "havale" | "pos";
  dagilim: { taksitId: string; tutar: number }[];
  iptal: { neden: string; kullanici: string; zaman: string } | null;
  kullanici: string;
};
export type Gider = { id: string; tarih: string; subeId: string | "merkez"; kategori: string; aciklama: string; tutar: number; kasa: "nakit" | "pos" | "banka" };
export type Virman = { id: string; tarih: string; kaynak: string; hedef: string; tutar: number; aciklama: string };

export type IslemKaydi = { id: string; zaman: string; kullanici: string; islem: string; detay: string; subeId: string | null };
export type IceAktarma = { id: string; zaman: string; dosya: string; ogrenciIds: string[]; veliIds: string[]; kayitIds: string[]; personelIds?: string[]; atlanan: number; geriAlindi: boolean };
export type KvkkBasvuru = { id: string; zaman: string; kisi: string; tur: "bilgi" | "silme" | "duzeltme"; durum: "acik" | "tamamlandi"; not: string };

export type Ayarlar = {
  smsBirimFiyat: number;
  gonderimBas: string;
  gonderimBit: string;
  devamsizlikEsigi: number;
  subeGecisDk: number;
  yoklamaHatirlatmaDk: number;
  etutIptalSaat: number;
  gelmeyenHakDussun: boolean;
  hatirlatmaGunleri: number[];
  saklamaAyAday: number;
  saklamaAyOgrenci: number;
  oturumGun: number;
};

export type Db = {
  surum: number;
  /* Kurum yapısı ve tanımlar (Bölüm 01) */
  kurum: Kurum;
  moduller: Record<ModulKey, boolean>;
  subeler: m.Sube[];
  sezonlar: m.Sezon[];
  dersler: m.Ders[];
  derslikler: m.Derslik[];
  dersSaatleri: m.DersSaati[];
  fiyatListesi: Record<string, number>;
  gruplar: m.Grup[];
  personel: Personel[];
  kullanicilar: Kullanici[];
  girisler: GirisKaydi[];
  rolYetkileri: Record<Rol, Record<string, boolean>>;
  veliler: Veli[];
  ogrenciler: Ogrenci[];
  kayitlar: Kayit[];
  program: ProgramSatiri[];
  tatiller: Tatil[];
  iptaller: Iptal[];
  yoklamalar: Record<string, Yoklama>;
  izinler: Izin[];
  adaylar: Aday[];
  odevler: Odev[];
  musaitlikler: Musaitlik[];
  randevular: Randevu[];
  paketler: Paket[];
  olaylar: BildirimOlayi[];
  gonderimler: Gonderim[];
  duyurular: Duyuru[];
  taksitler: Taksit[];
  tahsilatlar: Tahsilat[];
  giderler: Gider[];
  virmanlar: Virman[];
  islemler: IslemKaydi[];
  iceAktarmalar: IceAktarma[];
  kvkk: KvkkBasvuru[];
  hakedisDurum: Record<string, "onaylandi" | "odendi">;
  avanslar: { id: string; personelId: string; tarih: string; tutar: number; aciklama: string; subeId: string }[];
  ayarlar: Ayarlar;
  /** Sunucu otomasyonlarının tekrar üretmemek için tuttuğu kayıt (anahtar → tarih) */
  otomasyon: Record<string, string>;
};

export const SURUM = 5;

/* =========================== Örnek veri üretimi =========================== */
function rastgele(tohum: number) {
  return () => {
    tohum |= 0;
    tohum = (tohum + 0x6d2b79f5) | 0;
    let t = Math.imul(tohum ^ (tohum >>> 15), 1 | tohum);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const kizAdlari = ["Ayşe", "Zeynep", "Elif", "Defne", "Ecrin", "Asel", "Nehir", "Duru", "Azra", "Lina", "Ela", "Mira", "Eylül", "Ada", "Beren", "Masal", "Öykü", "İpek"];
const erkekAdlari = ["Ali", "Mehmet", "Emir", "Yusuf", "Kerem", "Ömer", "Eymen", "Aras", "Miraç", "Alp", "Çınar", "Poyraz", "Kuzey", "Berk", "Efe", "Mert", "Arda", "Batu"];
const soyadlar = ["Yıldız", "Aksoy", "Kılıç", "Erdem", "Güneş", "Taş", "Korkmaz", "Bulut", "Özkan", "Tekin", "Acar", "Uysal", "Sezer", "Bozkurt", "Kara", "Doğan", "Avcı", "Eren", "Toprak", "Ünal", "Çakır", "Yavuz", "Tuncer", "Sarı", "Kaplan", "Işık", "Oral", "Gündüz", "Altun", "Duman"];
const anneAdlari = ["Fatma", "Emine", "Seda", "Burcu", "Gizem", "Derya", "Esra", "Pınar", "Merve", "Aslı", "Tuğba", "Özlem"];
const babaAdlari = ["Ahmet", "Hasan", "Serkan", "Volkan", "Onur", "Tolga", "Kemal", "Erkan", "Cem", "Barış", "Levent", "Sinan"];
const okullar = ["Atatürk İlkokulu", "Cumhuriyet Ortaokulu", "Fatih Ortaokulu", "Yunus Emre İlkokulu", "Mimar Sinan Ortaokulu", "Gazi Ortaokulu"];
export const konular: Record<string, string[]> = {
  l1: ["Sözcükte anlam", "Paragrafta ana fikir", "Yazım kuralları", "Noktalama işaretleri", "Fiilimsiler", "Cümlenin ögeleri"],
  l2: ["Doğal sayılar", "Kesirler", "Ondalık gösterim", "Oran-orantı", "Cebirsel ifadeler", "Üslü ifadeler", "Kareköklü ifadeler"],
  l3: ["Hücre", "Kuvvet ve hareket", "Maddenin yapısı", "Işık", "Ses", "DNA ve genetik kod"],
  l4: ["Haritalar", "İlk Türk devletleri", "Ekonomi ve sosyal hayat"],
  l5: ["Greetings", "My family", "Daily routines", "Friendship", "Teen life", "Cooking"],
  l6: ["Kader inancı"],
};

const personelSeed: Personel[] = [
  { id: "p0", ad: "Ahmet", soyad: "Er", gorev: "genel-yonetici", telefon: "0532 100 00 00", eposta: "yonetim@ornekkurum.com", subeIds: ["s1", "s2", "s3"], anaSubeId: "s1", dersIds: [], baslangic: "2019-09-01", aktif: true, ucretTipi: "sabit", dersUcreti: 0, sabitUcret: 0 },
  { id: "p1", ad: "Elif", soyad: "Yılmaz", gorev: "sube-muduru", telefon: "0532 100 00 01", eposta: "elif@ornekkurum.com", subeIds: ["s1"], anaSubeId: "s1", dersIds: [], baslangic: "2020-09-01", aktif: true, ucretTipi: "sabit", dersUcreti: 0, sabitUcret: 40000 },
  { id: "p2", ad: "Murat", soyad: "Demir", gorev: "sube-muduru", telefon: "0532 100 00 02", eposta: "murat@ornekkurum.com", subeIds: ["s2"], anaSubeId: "s2", dersIds: [], baslangic: "2022-09-01", aktif: true, ucretTipi: "sabit", dersUcreti: 0, sabitUcret: 38000 },
  { id: "p3", ad: "Zeynep", soyad: "Kaya", gorev: "sube-muduru", telefon: "0532 100 00 03", eposta: "zeynep@ornekkurum.com", subeIds: ["s3"], anaSubeId: "s3", dersIds: [], baslangic: "2024-02-01", aktif: false, ucretTipi: "sabit", dersUcreti: 0, sabitUcret: 36000 },
  { id: "p4", ad: "Ayşe", soyad: "Arslan", gorev: "ogretmen", telefon: "0532 100 00 04", eposta: "ayse@ornekkurum.com", subeIds: ["s1"], anaSubeId: "s1", dersIds: ["l1", "l4"], baslangic: "2021-09-01", aktif: true, ucretTipi: "ders", dersUcreti: 450, sabitUcret: 0 },
  { id: "p5", ad: "Can", soyad: "Öztürk", gorev: "ogretmen", telefon: "0532 100 00 05", eposta: "can@ornekkurum.com", subeIds: ["s1", "s2"], anaSubeId: "s1", dersIds: ["l2"], baslangic: "2020-09-01", aktif: true, ucretTipi: "karma", dersUcreti: 300, sabitUcret: 15000 },
  { id: "p6", ad: "Selin", soyad: "Aydın", gorev: "ogretmen", telefon: "0532 100 00 06", eposta: "selin@ornekkurum.com", subeIds: ["s1"], anaSubeId: "s1", dersIds: ["l3"], baslangic: "2023-09-01", aktif: true, ucretTipi: "ders", dersUcreti: 450, sabitUcret: 0 },
  { id: "p7", ad: "Burak", soyad: "Şahin", gorev: "ogretmen", telefon: "0532 100 00 07", eposta: "burak@ornekkurum.com", subeIds: ["s1"], anaSubeId: "s1", dersIds: ["l2"], baslangic: "2022-09-01", aktif: true, ucretTipi: "ders", dersUcreti: 450, sabitUcret: 0 },
  { id: "p8", ad: "Deniz", soyad: "Çelik", gorev: "ogretmen", telefon: "0532 100 00 08", eposta: "deniz@ornekkurum.com", subeIds: ["s2", "s1"], anaSubeId: "s2", dersIds: ["l5"], baslangic: "2021-09-01", aktif: true, ucretTipi: "sabit", dersUcreti: 0, sabitUcret: 32000 },
  { id: "p9", ad: "Gül", soyad: "Koç", gorev: "sekreter", telefon: "0532 100 00 09", eposta: "gul@ornekkurum.com", subeIds: ["s1"], anaSubeId: "s1", dersIds: [], baslangic: "2021-08-15", aktif: true, ucretTipi: "sabit", dersUcreti: 0, sabitUcret: 28000 },
  { id: "p10", ad: "Emre", soyad: "Polat", gorev: "sekreter", telefon: "0532 100 00 10", eposta: "emre@ornekkurum.com", subeIds: ["s2", "s1"], anaSubeId: "s2", dersIds: [], baslangic: "2023-08-15", aktif: true, ucretTipi: "sabit", dersUcreti: 0, sabitUcret: 28000 },
];

const programSeed: [string, number, string, string, string, string][] = [
  // grup, gün, saat, ders, öğretmen, derslik
  ["g1", 1, "h1", "l1", "p4", "d2"], ["g1", 3, "h1", "l2", "p7", "d2"], ["g1", 5, "h1", "l1", "p4", "d2"], ["g1", 6, "h4", "l5", "p8", "d2"],
  ["g2", 1, "h2", "l2", "p5", "d1"], ["g2", 2, "h2", "l3", "p6", "d1"], ["g2", 5, "h2", "l2", "p5", "d1"], ["g2", 6, "h5", "l1", "p4", "d1"],
  ["g3", 2, "h1", "l2", "p7", "d1"], ["g3", 4, "h2", "l3", "p6", "d1"], ["g3", 5, "h3", "l3", "p6", "d1"], ["g3", 6, "h4", "l2", "p5", "d1"],
  ["g4", 1, "h3", "l2", "p7", "d2"], ["g4", 3, "h2", "l3", "p6", "d2"], ["g4", 5, "h3", "l2", "p7", "d2"], ["g4", 7, "h4", "l1", "p4", "d2"],
  ["g5", 2, "h7", "l2", "p5", "d4"], ["g5", 3, "h7", "l2", "p5", "d4"], ["g5", 4, "h7", "l5", "p8", "d4"], ["g5", 5, "h7", "l5", "p8", "d4"],
  ["g6", 2, "h8", "l5", "p8", "d5"], ["g6", 4, "h8", "l2", "p5", "d5"], ["g6", 5, "h8", "l5", "p8", "d5"],
];

const grupKayitSayisi: Record<string, number> = { g1: 11, g2: 16, g3: 12, g4: 9, g5: 13, g6: 7 };

export const varsayilanOlaylar: BildirimOlayi[] = [
  { key: "devamsizlik", ad: "Devamsızlık", kanal: "push+sms", aktif: true, sablon: "{ogrenci} bugün {saat} {ders} dersine katılmadı. {sube_adi} {sube_telefonu}" },
  { key: "dersIptal", ad: "Ders iptali / değişikliği", kanal: "push+sms", aktif: true, sablon: "{grup} {ders} dersi ({tarih} {saat}): {neden}. {sube_adi} {sube_telefonu}" },
  { key: "hosgeldin", ad: "Hoş geldiniz / portal daveti", kanal: "sms", aktif: true, sablon: "{ogrenci} kaydı tamamlandı, hoş geldiniz! Veli portalı: classmate.app/veli — {sube_adi}" },
  { key: "yeniOdev", ad: "Yeni ödev", kanal: "push", aktif: true, sablon: "{ogrenci} için yeni {ders} ödevi: {baslik}. Teslim: {teslim}", modul: "odev" },
  { key: "odevYapmadi", ad: "Ödev yapılmadı", kanal: "push", aktif: true, sablon: "{ogrenci} {ders} ödevini ({baslik}) teslim etmedi.", modul: "odev" },
  { key: "odevHatirlatma", ad: "Ödev teslim hatırlatması (1 gün önce)", kanal: "push", aktif: true, sablon: "Yarın teslim: {ders} — {baslik}", modul: "odev" },
  { key: "etutHatirlatma", ad: "Etüt hatırlatma", kanal: "push", aktif: true, sablon: "{ogrenci} için {tarih} {saat} etüt randevusu ({ogretmen}). {sube_adi}", modul: "etut" },
  { key: "duyuru", ad: "Duyuru", kanal: "push", aktif: true, sablon: "{baslik}: {metin}" },
  { key: "onKayitTesekkur", ad: "Ön kayıt teşekkür", kanal: "sms", aktif: true, sablon: "Bilgi talebiniz için teşekkürler, sizi en kısa sürede arayacağız. {sube_adi} {sube_telefonu}", modul: "onKayit" },
  { key: "taksitHatirlatma", ad: "Taksit hatırlatma (vade −3 gün)", kanal: "push+sms", aktif: true, sablon: "{ogrenci} için {tutar} tutarındaki taksitin vadesi {vade}. {sube_adi}", finans: true },
  { key: "gecikmisOdeme", ad: "Gecikmiş ödeme", kanal: "push+sms", aktif: true, sablon: "{vade} vadeli {tutar} ödemeniz henüz alınmamıştır. Bilginize sunarız. {sube_adi}", finans: true },
  { key: "odemeAlindi", ad: "Ödeme alındı", kanal: "push", aktif: true, sablon: "{tutar} ödemeniz alındı, teşekkür ederiz. Makbuz no: {makbuz}", finans: true },
];

export const varsayilanRolYetkileri: Record<Rol, Record<string, boolean>> = {
  "genel-yonetici": Object.fromEntries(["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14"].map((k) => [k, true])),
  "sube-muduru": { "01": false, "02": false, "03": true, "04": true, "05": true, "06": true, "07": true, "08": true, "09": true, "10": true, "11": true, "12": true, "13": true, "14": false },
  sekreter: { "01": false, "02": false, "03": true, "04": true, "05": true, "06": true, "07": true, "08": false, "09": true, "10": true, "11": true, "12": true, "13": false, "14": false },
  ogretmen: { "01": false, "02": false, "03": false, "04": false, "05": false, "06": true, "07": true, "08": true, "09": true, "10": false, "11": false, "12": true, "13": false, "14": false },
};

export const varsayilanAyarlar: Ayarlar = {
  smsBirimFiyat: 0.32,
  gonderimBas: "08:00",
  gonderimBit: "21:00",
  devamsizlikEsigi: 3,
  subeGecisDk: 30,
  yoklamaHatirlatmaDk: 15,
  etutIptalSaat: 12,
  gelmeyenHakDussun: true,
  hatirlatmaGunleri: [-3, 0, 3, 10],
  saklamaAyAday: 12,
  saklamaAyOgrenci: 24,
  oturumGun: 90,
};

export function ornekVeriUret(): Db {
  const r = rastgele(20261009);
  const sec = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  let sayac = 0;
  const id = (p: string) => `${p}${++sayac}`;

  const veliler: Veli[] = [];
  const ogrenciler: Ogrenci[] = [];
  const kayitlar: Kayit[] = [];
  const kullanilanTel = new Set<string>();
  const tel = () => {
    let t: string;
    do t = telefonNormalize("05" + String(30 + Math.floor(r() * 25)) + String(Math.floor(r() * 1e7)).padStart(7, "0"))!;
    while (kullanilanTel.has(t));
    kullanilanTel.add(t);
    return t;
  };

  const kayitAylari = ["2026-06", "2026-07", "2026-07", "2026-08", "2026-08", "2026-08", "2026-08", "2026-09", "2026-09", "2026-09", "2026-09", "2026-10"];
  let indeks = 0;
  for (const g of m.gruplar) {
    for (let k = 0; k < grupKayitSayisi[g.id]; k++, indeks++) {
      const kiz = r() < 0.5;
      const kardesi = indeks % 10 === 3 && ogrenciler.length > 7 ? ogrenciler[ogrenciler.length - 7] : null;
      const soyad = kardesi ? kardesi.soyad : soyadlar[indeks % soyadlar.length];
      let veliIds: string[];
      if (kardesi) veliIds = kardesi.veliIds;
      else {
        const anne: Veli = {
          id: id("v"), ad: sec(anneAdlari), soyad, telefon: tel(), eposta: "", yakinlik: "Anne",
          pushAcik: r() < 0.65, portalDavet: r() < 0.8 ? "giris-yapti" : "gonderildi", izinSms: true, izinTanitim: r() < 0.3,
        };
        veliler.push(anne);
        veliIds = [anne.id];
        if (r() < 0.35) {
          const baba: Veli = {
            id: id("v"), ad: sec(babaAdlari), soyad, telefon: tel(), eposta: "", yakinlik: "Baba",
            pushAcik: r() < 0.5, portalDavet: r() < 0.6 ? "giris-yapti" : "bekliyor", izinSms: true, izinTanitim: false,
          };
          veliler.push(baba);
          veliIds.push(baba.id);
        }
      }
      const dogumYili = 2026 - g.seviye - 6;
      const o: Ogrenci = {
        id: id("o"), ad: kiz ? sec(kizAdlari) : sec(erkekAdlari), soyad,
        dogum: `${dogumYili}-${String(1 + Math.floor(r() * 12)).padStart(2, "0")}-${String(1 + Math.floor(r() * 28)).padStart(2, "0")}`,
        cinsiyet: kiz ? "K" : "E", okul: sec(okullar), okulSinifi: `${g.seviye}-${sec(["A", "B", "C", "D"])}`,
        saglikNotu: r() < 0.08 ? sec(["Fıstık alerjisi", "Astım — inhaler çantasında", "Gözlük kullanıyor"]) : "",
        veliIds, birincilVeliId: veliIds[0], durum: "aktif", notlar: [],
      };
      ogrenciler.push(o);
      const ay = sec(kayitAylari);
      const gun = ay === "2026-10" ? 1 + Math.floor(r() * 8) : 1 + Math.floor(r() * 28);
      const liste = g.subeId === "s1" ? 13500 : 12000;
      const indirimler = kardesi ? [{ ad: "Kardeş indirimi", oran: 10 }] : r() < 0.15 ? [{ ad: "Erken kayıt", oran: 5 }] : [];
      const net = Math.round(liste * (1 - indirimler.reduce((t, i) => t + i.oran, 0) / 100));
      const tarih = `${ay}-${String(gun).padStart(2, "0")}`;
      kayitlar.push({
        id: id("k"), ogrenciId: o.id, sezonId: AKTIF_SEZON, subeId: g.subeId, grupId: g.id, sozlesmeNo: "", durum: "aktif",
        tarih, grupGecmisi: [{ grupId: g.id, tarih }], ekHizmetler: r() < 0.3 ? ["Kitap seti"] : [],
        kvkkOnay: { tarih, surum: "v1.2" }, listeFiyati: liste, indirimler, net,
      });
    }
  }
  // Sözleşme numaraları: şube içinde kayıt sırasına göre
  [...kayitlar].sort((a, b) => a.tarih.localeCompare(b.tarih)).forEach((k) => {
    const kod = m.subeler.find((s) => s.id === k.subeId)!.kod;
    k.sozlesmeNo = sozlesmeNo(kod, 2026, kayitlar.map((x) => x.sozlesmeNo));
  });

  const program: ProgramSatiri[] = programSeed.map(([grupId, gun, saatId, dersId, ogretmenId, derslikId], i) => ({
    id: `ps${i + 1}`, grupId, gun, saatId, dersId, ogretmenId, derslikId, baslangic: "2026-09-07", bitis: null,
  }));

  const tatiller: Tatil[] = [
    { id: "t1", tarih: "2026-10-29", ad: "Cumhuriyet Bayramı", subeId: null },
    { id: "t2", tarih: "2026-11-16", ad: "Ara tatil", subeId: null },
    { id: "t3", tarih: "2026-11-17", ad: "Ara tatil", subeId: null },
    { id: "t4", tarih: "2026-10-17", ad: "Tadilat (Kuzey)", subeId: "s2" },
  ];

  const db: Db = {
    surum: SURUM,
    kurum: { ...m.kurum },
    moduller: { ...varsayilanModuller },
    subeler: m.subeler.map((x) => ({ ...x })),
    sezonlar: m.sezonlar.map((x) => ({ ...x })),
    dersler: m.dersler.map((x) => ({ ...x })),
    derslikler: m.derslikler.map((x) => ({ ...x })),
    dersSaatleri: m.dersSaatleri.map((x) => ({ ...x })),
    fiyatListesi: { ...m.fiyatListesi },
    gruplar: m.gruplar.map((g) => ({ ...g })),
    personel: personelSeed.map((p) => ({ ...p })),
    kullanicilar: personelSeed.map((p) => ({
      id: "u" + p.id.slice(1), personelId: p.id, rol: p.gorev, subeIds: p.gorev === "genel-yonetici" ? "all" : p.subeIds,
      eposta: p.eposta, aktif: p.aktif, sonGiris: p.aktif ? `2026-10-0${1 + Math.floor(r() * 8)}T0${8 + Math.floor(r() * 2)}:${String(Math.floor(r() * 60)).padStart(2, "0")}` : "2026-06-12T17:02",
      ikiAdim: p.gorev === "genel-yonetici",
    })),
    girisler: [],
    rolYetkileri: JSON.parse(JSON.stringify(varsayilanRolYetkileri)),
    veliler,
    ogrenciler,
    kayitlar,
    program,
    tatiller,
    iptaller: [],
    yoklamalar: {},
    izinler: [],
    adaylar: [],
    odevler: [],
    musaitlikler: [],
    randevular: [],
    paketler: [],
    olaylar: varsayilanOlaylar.map((o) => ({ ...o })),
    gonderimler: [],
    duyurular: [],
    taksitler: [],
    tahsilatlar: [],
    giderler: [],
    virmanlar: [],
    islemler: [],
    iceAktarmalar: [],
    kvkk: [],
    hakedisDurum: { "2026-09_p4": "odendi", "2026-09_p6": "odendi", "2026-09_p7": "odendi", "2026-09_p5": "odendi", "2026-09_p8": "odendi" },
    avanslar: [],
    ayarlar: { ...varsayilanAyarlar },
    otomasyon: {},
  };

  // Giriş geçmişi
  for (const k of db.kullanicilar.filter((x) => x.aktif)) {
    for (let i = 0; i < 4; i++) {
      db.girisler.push({
        id: id("gl"),
        kullaniciId: k.id,
        tarih: `${tarihEkle(BUGUN, -Math.floor(r() * 9))}T${String(8 + Math.floor(r() * 10)).padStart(2, "0")}:${String(Math.floor(r() * 60)).padStart(2, "0")}`,
        cihaz: sec(["Chrome · Windows", "Safari · iPhone", "Chrome · Android", "Edge · Windows"]),
        basarili: r() > 0.08,
      });
    }
  }
  db.girisler.sort((a, b) => b.tarih.localeCompare(a.tarih));

  // Yoklama geçmişi: sezon başından dün akşama kadar + bugün başlamış bazı dersler
  for (let t = "2026-09-07"; t <= BUGUN; t = tarihEkle(t, 1)) {
    for (const o of oturumlar(db, t)) {
      // Bugün: yalnızca saati geçmiş derslerin bir kısmının yoklaması alınmış olsun
      if (t === BUGUN && (!["g1", "g2", "g5"].includes(o.satir.grupId) || o.bit > SIMDI)) continue;
      const durumlar: Record<string, YoklamaDurumu> = {};
      for (const ogr of grupOgrencileri(db, o.satir.grupId, t)) {
        const x = r();
        durumlar[ogr.id] = x < 0.065 ? "gelmedi" : x < 0.09 ? "gec" : x < 0.105 ? "izinli" : "geldi";
      }
      db.yoklamalar[o.id] = {
        oturumId: o.id, tarih: t, satirId: o.satir.id, grupId: o.satir.grupId, ogretmenId: o.satir.ogretmenId,
        durumlar, konu: sec(konular[o.satir.dersId] ?? ["Tekrar"]), kayitZamani: `${t}T${o.bit}`,
      };
      for (const [ogrId, d] of Object.entries(durumlar)) {
        if (d !== "gelmedi") continue;
        bildirimEkle(db, "devamsizlik", ogrId, {
          saat: o.bas, ders: dersAdi(o.satir.dersId),
        }, `${t}T${o.bas}`);
      }
    }
  }

  // Ders iptali örneği
  const iptalOturum = `ps9_2026-09-29`;
  db.iptaller.push({ oturumId: iptalOturum, neden: "Öğretmen raporlu", tarih: "2026-09-28", telafi: "2026-10-03" });

  // İzin bildirimi (veliden): yarın gelemeyecek
  const izinOgr = grupOgrencileri(db, "g3", BUGUN)[2];
  db.izinler.push({ id: id("iz"), ogrenciId: izinOgr.id, tarih: BUGUN, not: "Doktor randevusu var.", veliId: izinOgr.birincilVeliId, olusturma: "2026-10-08T20:14" });

  // Ön kayıtlar
  const kaynaklar = ["Tavsiye", "Instagram", "Google", "Tabela", "Eski öğrenci", "Web formu"];
  const durumlar: AdayDurum[] = ["yeni", "yeni", "gorusuldu", "gorusuldu", "deneme", "dusunuyor", "dusunuyor", "kayit", "kayit", "kayit", "vazgecti", "vazgecti", "yeni", "gorusuldu"];
  const nedenler = ["Fiyat", "Saat uymadı", "Başka kurum", "Ulaşım"];
  durumlar.forEach((d, i) => {
    const soyad = sec(soyadlar);
    const olusturma = tarihEkle(BUGUN, -Math.floor(r() * 40) - 1);
    const sonraki = d === "kayit" || d === "vazgecti" ? null : tarihEkle(BUGUN, Math.floor(r() * 5) - 2);
    db.adaylar.push({
      id: id("a"), veliAd: `${sec(anneAdlari)} ${soyad}`, veliTelefon: tel(), ogrenciAd: `${r() < 0.5 ? sec(kizAdlari) : sec(erkekAdlari)} ${soyad}`,
      seviye: 3 + Math.floor(r() * 6), okul: sec(okullar), subeId: i % 3 === 0 ? "s2" : "s1", sorumluId: i % 3 === 0 ? "p10" : "p9",
      kaynak: sec(kaynaklar), durum: d, sonrakiAksiyon: sonraki, denemeTarihi: d === "deneme" ? tarihEkle(BUGUN, 1) : null,
      olusturma, notlar: [
        { tarih: `${olusturma}T10:15`, yazar: "Gül Koç", metin: "Telefonla bilgi aldı. Hafta içi akşam saatlerini soruyor." },
        ...(d !== "yeni" ? [{ tarih: `${tarihEkle(olusturma, 3)}T14:30`, yazar: "Gül Koç", metin: "Tekrar arandı, program bilgisi verildi." }] : []),
      ],
      vazgecmeNedeni: d === "vazgecti" ? sec(nedenler) : null, teklif: null, rizaVar: true,
    });
  });

  // Ödevler
  const odevSeed: [string, string, string, string, number, number, boolean][] = [
    ["g2", "l2", "p5", "Kesirler alıştırması", -8, -2, true],
    ["g2", "l2", "p5", "Ondalık gösterim test 1", -1, 4, false],
    ["g3", "l3", "p6", "Hücre çizimi ve organeller", -6, -1, true],
    ["g1", "l1", "p4", "Okuma kitabı: 1–3. bölümler", -3, 3, false],
    ["g4", "l2", "p7", "Üslü ifadeler — 40 soru", -5, 0, false],
    ["g5", "l5", "p8", "Daily routines worksheet", -2, 3, false],
  ];
  for (const [grupId, dersId, ogretmenId, baslik, v, t, kontrol] of odevSeed) {
    const teslimler: Record<string, TeslimDurumu> = {};
    if (kontrol)
      for (const o of grupOgrencileri(db, grupId, BUGUN)) {
        const x = r();
        teslimler[o.id] = x < 0.1 ? "yapmadi" : x < 0.22 ? "eksik" : "yapti";
      }
    db.odevler.push({
      id: id("od"), ogretmenId, dersId, grupId, ogrenciIds: null, baslik, aciklama: "Defterine düzenli şekilde çözüp getir.",
      kaynak: dersId === "l2" ? "Kaynak kitap s. 42–48" : "", verilis: tarihEkle(BUGUN, v), teslim: tarihEkle(BUGUN, t),
      teslimler, notlar: {}, kontrolEdildi: kontrol,
    });
  }

  // Etüt
  db.musaitlikler.push(
    { id: id("mu"), ogretmenId: "p6", subeId: "s1", gun: 1, bas: "14:00", bit: "16:00" },
    { id: id("mu"), ogretmenId: "p5", subeId: "s1", gun: 3, bas: "14:00", bit: "16:00" },
    { id: id("mu"), ogretmenId: "p4", subeId: "s1", gun: 4, bas: "14:00", bit: "16:00" },
    { id: id("mu"), ogretmenId: "p8", subeId: "s2", gun: 1, bas: "15:00", bit: "16:20" },
    { id: id("mu"), ogretmenId: "p7", subeId: "s1", gun: 6, bas: "12:00", bit: "14:00" },
  );
  const ogrS1 = ogrenciler.filter((o) => aktifKayit(db, o.id)?.subeId === "s1");
  const ogrS2 = ogrenciler.filter((o) => aktifKayit(db, o.id)?.subeId === "s2");
  db.paketler.push(
    { id: "pk1", ogrenciId: ogrS1[20].id, ogretmenId: "p5", dersId: "l2", toplam: 8, kalan: 5, fiyat: 3600, tarih: "2026-09-15" },
    { id: "pk2", ogrenciId: ogrS1[30].id, ogretmenId: "p6", dersId: "l3", toplam: 8, kalan: 1, fiyat: 3600, tarih: "2026-09-10" },
    { id: "pk3", ogrenciId: ogrS2[4].id, ogretmenId: "p8", dersId: "l5", toplam: 4, kalan: 4, fiyat: 1900, tarih: "2026-10-06" },
  );
  const pzt = tarihEkle(BUGUN, 1 - haftaGunu(BUGUN));
  db.randevular.push(
    { id: id("r"), ogretmenId: "p6", subeId: "s1", tarih: pzt, bas: "14:00", bit: "14:40", tur: "bireysel", ogrenciIds: [ogrS1[30].id], dersId: "l3", durum: "yapildi", link: "", paketId: "pk2", olusturan: "yonetim" },
    { id: id("r"), ogretmenId: "p5", subeId: "s1", tarih: tarihEkle(pzt, 2), bas: "14:00", bit: "14:40", tur: "ozel", ogrenciIds: [ogrS1[20].id], dersId: "l2", durum: "yapildi", link: "", paketId: "pk1", olusturan: "yonetim" },
    { id: id("r"), ogretmenId: "p5", subeId: "s1", tarih: tarihEkle(pzt, 2), bas: "14:40", bit: "15:20", tur: "grup", ogrenciIds: [ogrS1[3].id, ogrS1[5].id, ogrS1[8].id], dersId: "l2", durum: "gelmedi", link: "", paketId: null, olusturan: "yonetim" },
    { id: id("r"), ogretmenId: "p7", subeId: "s1", tarih: tarihEkle(pzt, 5), bas: "12:00", bit: "12:40", tur: "bireysel", ogrenciIds: [ogrS1[40].id], dersId: "l2", durum: "planli", link: "", paketId: null, olusturan: "veli" },
    { id: id("r"), ogretmenId: "p8", subeId: "s2", tarih: tarihEkle(pzt, 7), bas: "15:00", bit: "15:40", tur: "online", ogrenciIds: [ogrS2[4].id], dersId: "l5", durum: "planli", link: "https://meet.google.com/abc-defg-hij", paketId: "pk3", olusturan: "yonetim" },
    { id: id("r"), ogretmenId: "p4", subeId: "s1", tarih: tarihEkle(pzt, 10), bas: "14:00", bit: "14:40", tur: "bireysel", ogrenciIds: [ogrS1[11].id], dersId: "l1", durum: "planli", link: "", paketId: null, olusturan: "veli" },
  );

  // Duyurular
  const tumVeliler = veliler.map((v) => v.id);
  db.duyurular.push(
    {
      id: id("du"), baslik: "Veli toplantısı", metin: "17 Ekim Cumartesi 11:00'de Merkez şubede veli toplantısı yapılacaktır.",
      hedef: { tur: "sube", deger: "s1" }, kanal: "push", zaman: "2026-10-05T10:00", zamanlanmis: false, gonderen: "Elif Yılmaz",
      aliciVeliIds: hedefVeliler(db, { tur: "sube", deger: "s1" }), okuyanVeliIds: [],
    },
    {
      id: id("du"), baslik: "29 Ekim tatili", metin: "Cumhuriyet Bayramı nedeniyle 29 Ekim Perşembe ders yapılmayacaktır. İyi bayramlar!",
      hedef: { tur: "tum", deger: null }, kanal: "push+sms", zaman: "2026-10-08T12:00", zamanlanmis: false, gonderen: "Ahmet Er",
      aliciVeliIds: tumVeliler, okuyanVeliIds: [],
    },
    {
      id: id("du"), baslik: "8. sınıflar deneme kampı", metin: "8. sınıflar için ara tatilde yoğunlaştırılmış tekrar kampı açılacaktır. Ayrıntılar yakında.",
      hedef: { tur: "seviye", deger: "8" }, kanal: "push", zaman: "2026-10-12T09:00", zamanlanmis: true, gonderen: "Ahmet Er",
      aliciVeliIds: hedefVeliler(db, { tur: "seviye", deger: "8" }), okuyanVeliIds: [],
    },
  );
  for (const d of db.duyurular) {
    d.okuyanVeliIds = d.zamanlanmis ? [] : d.aliciVeliIds.filter(() => r() < 0.62);
    if (!d.zamanlanmis) duyuruGonderimleri(db, d);
  }

  // Hoş geldiniz mesajları (son kayıtlar)
  for (const k of kayitlar.filter((k) => k.tarih >= "2026-09-20")) bildirimEkle(db, "hosgeldin", k.ogrenciId, {}, `${k.tarih}T11:00`);

  // Finans (modül kapalıyken de veri hazır tutulur)
  let makbuz = 0;
  for (const k of kayitlar) {
    const o = ogrenciler.find((x) => x.id === k.ogrenciId)!;
    const plan = taksitPlani(k.net, 0, 9, "2026-09-05");
    for (const p of plan)
      db.taksitler.push({ id: id("tk"), kayitId: k.id, ogrenciId: o.id, veliId: o.birincilVeliId, subeId: k.subeId, no: p.no, vade: p.vade, tutar: p.tutar, odenen: 0 });
  }
  for (const t of db.taksitler) {
    const odenecek = (t.vade === "2026-09-05" && r() < 0.95) || (t.vade === "2026-10-05" && r() < 0.72);
    if (!odenecek) continue;
    t.odenen = t.tutar;
    const gun = tarihEkle(t.vade, Math.floor(r() * 6) - 2);
    db.tahsilatlar.push({
      id: id("th"), makbuzNo: `${t.subeId === "s1" ? "MRK" : "KZY"}-M-${String(++makbuz).padStart(5, "0")}`, zaman: `${gun}T${String(10 + Math.floor(r() * 8)).padStart(2, "0")}:00`,
      veliId: t.veliId, subeId: t.subeId, alinanSubeId: t.subeId, tutar: t.tutar, yontem: sec(["nakit", "havale", "pos", "pos"]),
      dagilim: [{ taksitId: t.id, tutar: t.tutar }], iptal: null, kullanici: t.subeId === "s1" ? "Gül Koç" : "Emre Polat",
    });
  }
  db.giderler.push(
    { id: id("gd"), tarih: "2026-10-01", subeId: "s1", kategori: "Kira", aciklama: "Ekim kirası", tutar: 45000, kasa: "banka" },
    { id: id("gd"), tarih: "2026-10-01", subeId: "s2", kategori: "Kira", aciklama: "Ekim kirası", tutar: 32000, kasa: "banka" },
    { id: id("gd"), tarih: "2026-10-03", subeId: "s1", kategori: "Kırtasiye", aciklama: "Fotokopi kağıdı", tutar: 1850, kasa: "nakit" },
    { id: id("gd"), tarih: "2026-10-06", subeId: "merkez", kategori: "Yazılım", aciklama: "SMS paketi", tutar: 2400, kasa: "banka" },
    { id: id("gd"), tarih: "2026-10-07", subeId: "s2", kategori: "Fatura", aciklama: "Elektrik", tutar: 3120, kasa: "banka" },
  );

  // İşlem kaydı
  db.islemler.push(
    { id: id("ik"), zaman: "2026-10-08T15:12", kullanici: "Gül Koç", islem: "Kayıt", detay: "Yeni kayıt oluşturuldu", subeId: "s1" },
    { id: id("ik"), zaman: "2026-10-07T11:40", kullanici: "Ahmet Er", islem: "Yetki", detay: "Sekreter rolüne Etüt erişimi verildi", subeId: null },
    { id: id("ik"), zaman: "2026-10-06T09:05", kullanici: "Murat Demir", islem: "Grup değişikliği", detay: "Öğrenci 4-A grubuna taşındı", subeId: "s2" },
    { id: id("ik"), zaman: "2026-10-02T16:22", kullanici: "Ahmet Er", islem: "Modül", detay: "Ödev modülü açıldı", subeId: null },
  );

  db.kvkk.push({ id: id("kv"), zaman: "2026-10-03T10:00", kisi: "Eski aday veli (A*** K***)", tur: "silme", durum: "tamamlandi", not: "Aday kaydı anonimleştirildi." });

  // Geçmiş gönderimler iletilmiş sayılır (birkaçı başarısız: tekrar deneme ekranı için)
  db.gonderimler.forEach((g, i) => {
    g.durum = g.kanal === "sms" && i % 47 === 5 ? "basarisiz" : "iletildi";
    if (g.durum === "basarisiz") g.hata = "Operatör yanıtı: numara ulaşılamıyor";
  });

  return db;
}

/* =========================== Yardımcılar =========================== */
let idSayac = Date.now() % 100000;
export const yeniId = (p: string) => `${p}${(++idSayac).toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
export const simdiZaman = () => `${BUGUN}T${SIMDI}`;

/**
 * Tanım kaynağı: sube(), ders(), saat() gibi kısa yardımcılar tanımları buradan okur.
 * Tarayıcı deposu ve sunucu, veri her yüklendiğinde/değiştiğinde bunu çağırır.
 */
let tanim: Pick<Db, "subeler" | "dersler" | "derslikler" | "dersSaatleri" | "sezonlar" | "kurum" | "fiyatListesi"> = {
  subeler: m.subeler, dersler: m.dersler, derslikler: m.derslikler, dersSaatleri: m.dersSaatleri, sezonlar: m.sezonlar, kurum: m.kurum, fiyatListesi: m.fiyatListesi,
};
export function tanimKaynagi(d: Db) {
  if (!d?.subeler) return;
  tanim = d;
  AKTIF_SEZON = d.sezonlar.find((s) => s.aktif)?.id ?? AKTIF_SEZON;
}
export const tanimlar = () => tanim;
export const sube = (id: string | null | undefined) => tanim.subeler.find((s) => s.id === id);
export const dersAdi = (id: string) => tanim.dersler.find((d) => d.id === id)?.ad ?? "—";
export const ders = (id: string) => tanim.dersler.find((d) => d.id === id);
export const derslikAdi = (id: string) => tanim.derslikler.find((d) => d.id === id)?.ad ?? "—";
export const saat = (id: string) => tanim.dersSaatleri.find((h) => h.id === id);
export const tamAd = (x: { ad: string; soyad: string } | undefined) => (x ? `${x.ad} ${x.soyad}`.trim() : "—");

export function grup(d: Db, id: string) {
  return d.gruplar.find((g) => g.id === id);
}
export function grupEtiket(d: Db, id: string) {
  const g = grup(d, id);
  return g ? `${sube(g.subeId)?.kod ?? ""} ${g.ad}` : "—";
}
export function personelAdi(d: Db, id: string) {
  return tamAd(d.personel.find((p) => p.id === id));
}

export function aktifKayit(d: Db, ogrenciId: string) {
  return d.kayitlar.find((k) => k.ogrenciId === ogrenciId && k.sezonId === AKTIF_SEZON && k.durum !== "iptal");
}

export function grupOgrencileri(d: Db, grupId: string, _tarih?: string) {
  const ids = new Set(d.kayitlar.filter((k) => k.grupId === grupId && k.durum === "aktif").map((k) => k.ogrenciId));
  return d.ogrenciler.filter((o) => ids.has(o.id)).sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
}

export function grupDoluluk(d: Db, grupId: string) {
  return d.kayitlar.filter((k) => k.grupId === grupId && k.durum === "aktif").length;
}

export function ogrenciVelileri(d: Db, o: Ogrenci) {
  return o.veliIds.map((id) => d.veliler.find((v) => v.id === id)).filter(Boolean) as Veli[];
}

export type Oturum = { id: string; tarih: string; satir: ProgramSatiri; bas: string; bit: string; subeId: string; iptal: Iptal | null; tatil: Tatil | null };

/** Haftalık şablondan o güne ait ders oturumları üretilir (06). */
export function oturumlar(d: Db, tarih: string): Oturum[] {
  const gun = haftaGunu(tarih);
  return d.program
    // Grubu veya ders saati görünmeyen (yetki dışı / silinmiş) satırlar atlanır
    .filter((p) => p.gun === gun && p.baslangic <= tarih && (!p.bitis || p.bitis >= tarih) && grup(d, p.grupId) && saat(p.saatId))
    .map((p) => {
      const g = grup(d, p.grupId)!;
      const h = saat(p.saatId)!;
      const oid = `${p.id}_${tarih}`;
      return {
        id: oid, tarih, satir: p, bas: h.baslangic, bit: h.bitis, subeId: g.subeId,
        iptal: d.iptaller.find((i) => i.oturumId === oid) ?? null,
        tatil: d.tatiller.find((t) => t.tarih === tarih && (!t.subeId || t.subeId === g.subeId)) ?? null,
      };
    })
    .sort((a, b) => dakika(a.bas) - dakika(b.bas));
}

/** Duyuru hedefinden veli listesi */
export function hedefVeliler(d: Db, hedef: Duyuru["hedef"]): string[] {
  const ogr = d.ogrenciler.filter((o) => {
    if (o.durum !== "aktif") return false;
    const k = aktifKayit(d, o.id);
    if (!k || k.durum !== "aktif") return false;
    if (hedef.tur === "tum") return true;
    if (hedef.tur === "sube") return k.subeId === hedef.deger;
    if (hedef.tur === "grup") return k.grupId === hedef.deger;
    return String(grup(d, k.grupId)?.seviye) === hedef.deger;
  });
  return [...new Set(ogr.flatMap((o) => o.veliIds))];
}

/** Olaydan veli bildirimleri üretir (10). Olay kapalıysa hiçbir şey göndermez. */
export function bildirimEkle(
  d: Db,
  olay: OlayKey,
  ogrenciId: string,
  degiskenler: Record<string, string>,
  zaman = simdiZaman(),
  yalnizBirincil = false,
) {
  const tanim = d.olaylar.find((o) => o.key === olay);
  if (!tanim || !tanim.aktif) return 0;
  const o = d.ogrenciler.find((x) => x.id === ogrenciId);
  if (!o) return 0;
  const k = aktifKayit(d, o.id);
  const s = sube(k?.subeId);
  const veliler = ogrenciVelileri(d, o).filter((v) => !yalnizBirincil || v.id === o.birincilVeliId);
  for (const v of veliler) {
    const kanal = kanalSec(tanim.kanal, v.pushAcik);
    const metin = sablonDoldur(tanim.sablon, {
      ogrenci: o.ad, grup: k ? grupEtiket(d, k.grupId) : "", sube_adi: s?.ad ?? "", sube_telefonu: s?.telefon ?? "", ...degiskenler,
    });
    d.gonderimler.push({
      id: yeniId("gn"), zaman, olay, veliId: v.id, alici: `${tamAd(v)} · ${v.telefon}`, ogrenciId, subeId: k?.subeId ?? "s1", kanal, metin,
      durum: "bekliyor",
      maliyet: kanal === "sms" ? smsBoyu(metin) * d.ayarlar.smsBirimFiyat : 0,
    });
  }
  return veliler.length;
}

export function duyuruGonderimleri(d: Db, du: Duyuru) {
  for (const vid of du.aliciVeliIds) {
    const v = d.veliler.find((x) => x.id === vid);
    if (!v) continue;
    const ogr = d.ogrenciler.find((o) => o.veliIds.includes(vid));
    const k = ogr ? aktifKayit(d, ogr.id) : undefined;
    const kanal = du.kanal === "push+sms" ? kanalSec("push+sms", v.pushAcik) : "push";
    const s = sube(k?.subeId);
    const metin = sablonDoldur(`${du.baslik}: ${du.metin}`, { sube_adi: s?.ad ?? "", sube_telefonu: s?.telefon ?? "", ogrenci: ogr?.ad ?? "" });
    d.gonderimler.push({
      id: yeniId("gn"), zaman: du.zaman, olay: "duyuru", veliId: vid, alici: `${tamAd(v)} · ${v.telefon}`, ogrenciId: ogr?.id ?? null,
      subeId: k?.subeId ?? "s1", kanal, metin, durum: "bekliyor", maliyet: kanal === "sms" ? smsBoyu(metin) * d.ayarlar.smsBirimFiyat : 0,
    });
  }
}

/** Öğrencinin yoklama geçmişi (yeniden eskiye) */
export function ogrenciYoklamalari(d: Db, ogrenciId: string, bas?: string, bit?: string) {
  return Object.values(d.yoklamalar)
    .filter((y) => y.durumlar[ogrenciId] && (!bas || y.tarih >= bas) && (!bit || y.tarih <= bit))
    .map((y) => ({ y, durum: y.durumlar[ogrenciId] }))
    .sort((a, b) => b.y.tarih.localeCompare(a.y.tarih) || b.y.kayitZamani.localeCompare(a.y.kayitZamani));
}

export function smsBoyuMaliyet(d: Db, metin: string) {
  return smsBoyu(metin) * d.ayarlar.smsBirimFiyat;
}

export function islemYaz(d: Db, kullanici: string, islem: string, detay: string, subeId: string | null = null) {
  d.islemler.unshift({ id: yeniId("ik"), zaman: simdiZaman(), kullanici, islem, detay, subeId });
}

export const taksitAdi = (no: number) => (no === 0 ? "Peşinat" : no >= 99 ? "Ek kalem" : `${no}. taksit`);

export function taksitKalan(t: Taksit) {
  return Math.round((t.tutar - t.odenen) * 100) / 100;
}

export function bugunIso() {
  return BUGUN;
}

export { isoTarih };
