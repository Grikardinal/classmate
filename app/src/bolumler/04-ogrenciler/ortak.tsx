/** Bölüm 04 ekranlarının ortak parçaları */
import { Badge } from "@/components/ui";
import type { Kayit, Veli } from "@/data/store";
import { kayitDurumBilgisi } from "./kurallar";

export const tarihTR = (iso: string) => (iso ? new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("tr-TR") : "—");

export function KayitDurumRozeti({ durum }: { durum: Kayit["durum"] }) {
  const b = kayitDurumBilgisi(durum);
  return <Badge variant={b.renk}>{b.ad}</Badge>;
}

export type VeliForm = { mevcutId: string | null; ad: string; soyad: string; telefon: string; eposta: string; yakinlik: Veli["yakinlik"] };
export const bosVeli = (): VeliForm => ({ mevcutId: null, ad: "", soyad: "", telefon: "", eposta: "", yakinlik: "Anne" });
