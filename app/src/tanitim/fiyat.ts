/** Onaylı fiyatlar (KDV dahil, karar 2026-11-09). Saf kurallar: arayüz ve test paylaşır. */
export const EK_SUBE_YILLIK = 15_000;
/** Yıllık alım 2 ay bedavadır: aylık fiyat, yıllık fiyatın onda biridir. */
export const YILLIK_AY_KARSILIGI = 10;
export const EK_SUBE_AYLIK = EK_SUBE_YILLIK / YILLIK_AY_KARSILIGI;

export type Paket = { ad: string; sube: number; not: string; ekSubeli?: boolean; oneCikan?: boolean };

export const paketler: Paket[] = [
  { ad: "1 Şube", sube: 1, not: "Tek şubeli kurumlar için" },
  { ad: "2 Şube", sube: 2, not: "İki şubeyi tek yerden yönetin", oneCikan: true },
  { ad: "3 Şube ve üzeri", sube: 3, not: "3 şube dahil", ekSubeli: true },
];

/** Şube sayısına göre yıllık toplam; geçersiz sayıda hata verir. */
export function yillikFiyat(sube: number): number {
  if (!Number.isInteger(sube) || sube < 1) throw new Error("Şube sayısı en az 1 olmalı.");
  if (sube === 1) return 24_000;
  if (sube === 2) return 42_000;
  return 57_000 + (sube - 3) * EK_SUBE_YILLIK;
}

export const aylikFiyat = (sube: number) => yillikFiyat(sube) / YILLIK_AY_KARSILIGI;

/** 12 ay aylık ödemeye göre yıllık alımın kazancı */
export const yillikKazanc = (sube: number) => aylikFiyat(sube) * 12 - yillikFiyat(sube);
