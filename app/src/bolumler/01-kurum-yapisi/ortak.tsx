/** Bölüm 01 ekranlarının ortak yardımcıları */
import { Lock } from "lucide-react";
import { Alert } from "@/components/ui";
import { useOturum } from "@/context/AppContext";

/** Kurum geneli tanımlar (kurum, şube, sezon, ders, fiyat, modül) yalnızca genel yöneticinindir. */
export function useGenel() {
  return useOturum().rol === "genel-yonetici";
}

/**
 * Şubeye özel tanımları (grup, derslik, ders saati) yazabilir mi:
 * genel yönetici veya Bölüm 02'den "01" yetkisi verilmiş rol. Şube kapsamını sunucu ayrıca denetler.
 */
export function useSubeTanimYazar() {
  const o = useOturum();
  return o.rol === "genel-yonetici" || o.yetki("01");
}

export function SadeceGenel() {
  return <Alert icon={<Lock />}>Kurum geneli tanımları yalnızca genel yönetici değiştirebilir.</Alert>;
}

export function HataMetni({ hata, className }: { hata: string | null | undefined; className?: string }) {
  if (!hata) return null;
  return (
    <p role="alert" className={className ?? "text-xs text-danger"}>
      {hata}
    </p>
  );
}

export const tarihGoster = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
};
