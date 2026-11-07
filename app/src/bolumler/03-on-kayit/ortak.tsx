/**
 * Bölüm 03 ortak ekran yardımcıları: tarih gösterimi, aksiyon tarihi rozeti, yazmadan önce sunucuyla aynı denetim.
 */
import * as React from "react";
import { useApp, useOturum } from "@/context/AppContext";
import { BUGUN, useDb, type Aday } from "@/data/store";
import { gunFarki } from "@/lib/kurallar";
import { cn } from "@/lib/utils";
import { acikMi, adayYazmaEngeli, type Hata } from "./kurallar";

export const tarihKisa = (iso: string | null) =>
  iso ? new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" }) : "—";

export function AksiyonTarihi({ a }: { a: Aday }) {
  if (!a.sonrakiAksiyon || !acikMi(a)) return <span className="text-muted-foreground">—</span>;
  const fark = gunFarki(BUGUN, a.sonrakiAksiyon);
  return (
    <span className={cn("tabular-nums", fark < 0 ? "font-medium text-danger" : fark === 0 ? "font-medium text-warning" : "")}>
      {fark === 0 ? "Bugün" : fark < 0 ? `${-fark} gün gecikti` : tarihKisa(a.sonrakiAksiyon)}
    </span>
  );
}

/** Kullanıcının kapsamı dışında kalan şube mi (devirden sonra aday görünmez) */
export function useKapsamDisi() {
  const { rol, kapsam } = useOturum();
  return (subeId: string) => rol !== "genel-yonetici" && !kapsam.includes(subeId);
}

/** Sunucudaki onKayitDenetle ile aynı kural: kaydetmeden önce ekranda göstermek için */
export function useAdayDenetimi() {
  const d = useDb();
  const { moduller } = useApp();
  const { yetki, rol, kapsam } = useOturum();
  // Sunucuyla aynı: genel yönetici için kapsam verilmez (kapsam dışına devir kuralı uygulanmaz)
  const devirKapsami = rol === "genel-yonetici" ? undefined : kapsam;
  return React.useCallback(
    (a: Aday, eski?: Aday): Hata => {
      const adaylar = eski ? d.adaylar.map((x) => (x.id === a.id ? a : x)) : [a, ...d.adaylar];
      return adayYazmaEngeli(a, eski, { ...d, adaylar }, { modulAcik: moduller.onKayit, onKayitYetkisi: yetki("03"), kvkkYetkisi: yetki("14"), kapsam: devirKapsami, istemci: true });
    },
    [d, moduller.onKayit, yetki, devirKapsami],
  );
}
