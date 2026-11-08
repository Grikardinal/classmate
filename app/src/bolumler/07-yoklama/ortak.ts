import type { YoklamaDurumu } from "@/lib/kurallar";

export const durumlar: { key: YoklamaDurumu; ad: string; kisa: string; sinif: string }[] = [
  { key: "geldi", ad: "Geldi", kisa: "✓", sinif: "bg-success text-white" },
  { key: "gelmedi", ad: "Gelmedi", kisa: "Yok", sinif: "bg-danger text-white" },
  { key: "gec", ad: "Geç", kisa: "Geç", sinif: "bg-warning text-white" },
  { key: "izinli", ad: "İzinli", kisa: "İzin", sinif: "bg-muted-foreground text-white" },
];
export const tarihUzun = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" });
