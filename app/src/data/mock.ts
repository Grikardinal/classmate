/** Kurum yapısı için örnek (uydurma) tanımlar — gerçek kişisel veri içermez. Arka uç bağlanınca kaldırılacak. */

export type Sube = { id: string; ad: string; kod: string; adres: string; telefon: string; mudur: string; aktif: boolean };
export type Sezon = { id: string; ad: string; baslangic: string; bitis: string; aktif: boolean };
export type Grup = {
  id: string;
  subeId: string;
  sezonId: string;
  seviye: number;
  ad: string;
  kapasite: number;
  derslikId: string;
  rehberId: string;
};
export type Ders = { id: string; ad: string; kisaAd: string; renk: string; aktif: boolean };
export type Derslik = { id: string; subeId: string; ad: string; kapasite: number };
export type DersSaati = { id: string; subeId: string; gunTipi: "hafta-ici" | "hafta-sonu"; sira: number; baslangic: string; bitis: string };

export const kurum = {
  ad: "Örnek Eğitim Kurumu",
  eposta: "info@ornekkurum.com",
  vergiNo: "1234567890",
  makbuzBasligi: "Örnek Eğitim Kurumu — Kayıt ve Muvafakat Formu",
};

export const subeler: Sube[] = [
  { id: "s1", ad: "Merkez", kod: "MRK", adres: "Cumhuriyet Mah. Okul Sk. No:4", telefon: "0212 555 10 10", mudur: "Elif Yılmaz", aktif: true },
  { id: "s2", ad: "Kuzey Şubesi", kod: "KZY", adres: "Yıldız Mah. Bahar Cd. No:18", telefon: "0212 555 20 20", mudur: "Murat Demir", aktif: true },
  { id: "s3", ad: "Sahil Şubesi", kod: "SHL", adres: "Deniz Mah. Liman Sk. No:2", telefon: "0212 555 30 30", mudur: "Zeynep Kaya", aktif: false },
];

export const sezonlar: Sezon[] = [
  { id: "z1", ad: "2025-2026", baslangic: "2025-09-08", bitis: "2026-06-19", aktif: false },
  { id: "z2", ad: "2026-2027", baslangic: "2026-09-07", bitis: "2027-06-18", aktif: true },
  { id: "z3", ad: "Yaz Okulu 2027", baslangic: "2027-07-01", bitis: "2027-08-15", aktif: false },
];

export const derslikler: Derslik[] = [
  { id: "d1", subeId: "s1", ad: "Derslik 1", kapasite: 16 },
  { id: "d2", subeId: "s1", ad: "Derslik 2", kapasite: 14 },
  { id: "d3", subeId: "s1", ad: "Etüt Odası", kapasite: 6 },
  { id: "d4", subeId: "s2", ad: "Mavi Sınıf", kapasite: 15 },
  { id: "d5", subeId: "s2", ad: "Yeşil Sınıf", kapasite: 12 },
];

export const gruplar: Grup[] = [
  { id: "g1", subeId: "s1", sezonId: "z2", seviye: 3, ad: "3-A", kapasite: 14, derslikId: "d2", rehberId: "p4" },
  { id: "g2", subeId: "s1", sezonId: "z2", seviye: 5, ad: "5-A", kapasite: 16, derslikId: "d1", rehberId: "p5" },
  { id: "g3", subeId: "s1", sezonId: "z2", seviye: 6, ad: "6-A", kapasite: 16, derslikId: "d1", rehberId: "p6" },
  { id: "g4", subeId: "s1", sezonId: "z2", seviye: 8, ad: "8-A", kapasite: 14, derslikId: "d2", rehberId: "p7" },
  { id: "g5", subeId: "s2", sezonId: "z2", seviye: 4, ad: "4-A", kapasite: 15, derslikId: "d4", rehberId: "p8" },
  { id: "g6", subeId: "s2", sezonId: "z2", seviye: 7, ad: "7-A", kapasite: 12, derslikId: "d5", rehberId: "p5" },
];

export const dersler: Ders[] = [
  { id: "l1", ad: "Türkçe", kisaAd: "TÜR", renk: "#ef4444", aktif: true },
  { id: "l2", ad: "Matematik", kisaAd: "MAT", renk: "#4f46e5", aktif: true },
  { id: "l3", ad: "Fen Bilimleri", kisaAd: "FEN", renk: "#16a34a", aktif: true },
  { id: "l4", ad: "Sosyal Bilgiler", kisaAd: "SOS", renk: "#d97706", aktif: true },
  { id: "l5", ad: "İngilizce", kisaAd: "İNG", renk: "#0891b2", aktif: true },
  { id: "l6", ad: "Din Kültürü", kisaAd: "DİN", renk: "#9333ea", aktif: false },
];

export const dersSaatleri: DersSaati[] = [
  { id: "h1", subeId: "s1", gunTipi: "hafta-ici", sira: 1, baslangic: "16:00", bitis: "16:40" },
  { id: "h2", subeId: "s1", gunTipi: "hafta-ici", sira: 2, baslangic: "16:50", bitis: "17:30" },
  { id: "h3", subeId: "s1", gunTipi: "hafta-ici", sira: 3, baslangic: "17:40", bitis: "18:20" },
  { id: "h4", subeId: "s1", gunTipi: "hafta-sonu", sira: 1, baslangic: "09:30", bitis: "10:10" },
  { id: "h5", subeId: "s1", gunTipi: "hafta-sonu", sira: 2, baslangic: "10:20", bitis: "11:00" },
  { id: "h6", subeId: "s1", gunTipi: "hafta-sonu", sira: 3, baslangic: "11:10", bitis: "11:50" },
  { id: "h7", subeId: "s2", gunTipi: "hafta-ici", sira: 1, baslangic: "16:30", bitis: "17:10" },
  { id: "h8", subeId: "s2", gunTipi: "hafta-ici", sira: 2, baslangic: "17:20", bitis: "18:00" },
  { id: "h9", subeId: "s2", gunTipi: "hafta-sonu", sira: 1, baslangic: "10:00", bitis: "10:40" },
];

/** Varsayılan fiyat listesi (yalnızca Finans modülü açıkken kullanılır); şube bazında farklılaşabilir. */
export const fiyatListesi: Record<string, number> = { s1: 13500, s2: 12000, s3: 12000 };
export const ekHizmetler = [
  { ad: "Kitap seti", fiyat: 1200 },
  { ad: "Etüt paketi (8 ders)", fiyat: 3600 },
  { ad: "Yaz okulu", fiyat: 4500 },
];
export const indirimTurleri = [
  { ad: "Kardeş indirimi", oran: 10 },
  { ad: "Erken kayıt", oran: 5 },
  { ad: "Personel yakını", oran: 20 },
];

export const gunAdlari = ["", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
export const gunKisa = ["", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
