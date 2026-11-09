/**
 * Bölüm 10 · İletişim ve bildirimler
 * Doküman: docs/bolumler/10-iletisim-ve-bildirimler.md
 * Kanal kararı: uygulama içi bildirim (push) ana kanal, SMS yalnızca kritik durumlar ve yedek; WhatsApp v2.
 */
import * as React from "react";
import { BellRing, History, Megaphone, Settings2 } from "lucide-react";
import { PageHeader, Tabs } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { Ayarlar } from "./Ayarlar";
import { BildirimMerkezi } from "./BildirimMerkezi";
import { Duyurular } from "./Duyurular";
import { GonderimKaydi } from "./GonderimKaydi";

export default function Iletisim() {
  const [sekme, setSekme] = React.useState<"merkez" | "duyuru" | "kayit" | "ayar">("merkez");
  const { rol } = useOturum();
  return (
    <div className="grid gap-6">
      <PageHeader code="10" title="İletişim ve bildirimler" description="Olayları veliye doğru kanaldan, doğru metinle ve doğru zamanda ulaştırın." />
      <Tabs
        value={sekme}
        onChange={setSekme}
        items={[
          { value: "merkez", label: "Bildirim merkezi", icon: <BellRing /> },
          { value: "duyuru", label: "Duyurular", icon: <Megaphone /> },
          { value: "kayit", label: "Gönderim kaydı", icon: <History /> },
          ...(rol === "genel-yonetici" ? [{ value: "ayar" as const, label: "Ayarlar", icon: <Settings2 /> }] : []),
        ]}
      />
      {sekme === "merkez" && <BildirimMerkezi />}
      {sekme === "duyuru" && <Duyurular />}
      {sekme === "kayit" && <GonderimKaydi />}
      {sekme === "ayar" && <Ayarlar />}
    </div>
  );
}
