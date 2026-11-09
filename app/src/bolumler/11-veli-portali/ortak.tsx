/** Bölüm 11 portal ekranlarının ortak parçaları: bağlam, bölüm başlığı, yoklama rozetleri, bildirim açma */
import * as React from "react";
import { Link } from "react-router-dom";
import { toast } from "@/components/ui";
import type { Ogrenci, Veli } from "@/data/store";
import { pushAboneOl } from "./push";

export type PortalCtx = {
  veli: Veli;
  cocuklar: Ogrenci[];
  cocuk: Ogrenci;
  setCocukId: (id: string) => void;
  ogrenciModu: boolean;
  setOgrenciModu: (v: boolean) => void;
  cikis: () => void;
  /** Veli işlemi: sunucu ucunu çağırır, ardından güncel veriyi yükler */
  islem: (yol: string, govde?: unknown, basari?: string) => Promise<boolean>;
};
export const PortalContext = React.createContext<PortalCtx | null>(null);
export const usePortal = () => React.useContext(PortalContext)!;

/** Bu cihazı gerçekten aboneye çevirir; abonelik olmadan "bildirim açık" işaretlenmez */
export function useBildirimAc() {
  const { islem } = usePortal();
  return async () => {
    const r = await pushAboneOl();
    if (r === "tamam") await islem("/api/veli/tercih", { pushAcik: true }, "Bildirimler açıldı. Önemli mesajlar artık bu cihaza gelecek.");
    else if (r === "izin-yok") toast("Bildirim izni verilmedi. Tarayıcı ayarlarından izin verebilirsiniz.", "uyari");
    else toast("Bu tarayıcı bildirimleri desteklemiyor. iPhone'da önce Paylaş → “Ana Ekrana Ekle” deyin, uygulamayı oradan açın.", "uyari");
  };
}

export function Bolum({ baslik, children, link }: { baslik: string; children: React.ReactNode; link?: { to: string; ad: string } }) {
  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold">{baslik}</h2>
        {link && <Link to={link.to} className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-primary">{link.ad} →</Link>}
      </div>
      {children}
    </section>
  );
}

export const yoklamaRenk = { geldi: "success", gelmedi: "danger", gec: "warning", izinli: "secondary" } as const;
export const yoklamaAd = { geldi: "Geldi", gelmedi: "Gelmedi", gec: "Geç geldi", izinli: "İzinli" } as const;
export const tarihKisa = (iso: string) => new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short", weekday: "short" });
