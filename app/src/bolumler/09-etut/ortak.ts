import type { Randevu } from "@/data/store";

export const durumRozet: Record<Randevu["durum"], { ad: string; v: "default" | "success" | "danger" | "secondary" }> = {
  planli: { ad: "Planlı", v: "default" },
  yapildi: { ad: "Yapıldı", v: "success" },
  gelmedi: { ad: "Gelmedi", v: "danger" },
  iptal: { ad: "İptal", v: "secondary" },
};
export const tarihKisa = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
