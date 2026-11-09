/** Onaylı yıllık fiyatlar (KDV dahil, karar 2026-11-09). Saf kurallar: arayüz ve test paylaşır. */
export const EK_SUBE_FIYATI = 15_000;

export type Paket = { ad: string; sube: number; fiyat: number; not: string; oneCikan?: boolean };

export const paketler: Paket[] = [
  { ad: "1 Şube", sube: 1, fiyat: 24_000, not: "Tek şubeli kurumlar için" },
  { ad: "2 Şube", sube: 2, fiyat: 42_000, not: "İki şubeyi tek yerden yönetin", oneCikan: true },
  { ad: "3 Şube ve üzeri", sube: 3, fiyat: 57_000, not: `3 şube dahil, sonraki her şube +${EK_SUBE_FIYATI.toLocaleString("tr-TR")} ₺` },
];

/** Şube sayısına göre yıllık toplam; geçersiz sayıda hata verir. */
export function yillikFiyat(sube: number): number {
  if (!Number.isInteger(sube) || sube < 1) throw new Error("Şube sayısı en az 1 olmalı.");
  if (sube === 1) return 24_000;
  if (sube === 2) return 42_000;
  return 57_000 + (sube - 3) * EK_SUBE_FIYATI;
}
