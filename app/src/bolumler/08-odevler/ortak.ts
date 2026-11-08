/** Bölüm 08 ekranlarının ortak görünüm sabitleri */
import type { TeslimDurumu } from "@/data/store";

export const tarihKisa = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" });

export const teslimSecenek: { key: TeslimDurumu; ad: string; sinif: string }[] = [
  { key: "yapti", ad: "Yaptı", sinif: "bg-success text-white" },
  { key: "eksik", ad: "Eksik", sinif: "bg-warning text-white" },
  { key: "yapmadi", ad: "Yapmadı", sinif: "bg-danger text-white" },
];
