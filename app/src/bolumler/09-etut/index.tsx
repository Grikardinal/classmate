/**
 * Bölüm 09 · Etüt ve birebir (özel) ders (v2) — Etüt modülü açıkken görünür
 * Doküman: docs/bolumler/09-etut-ve-birebir-ders.md
 */
import * as React from "react";
import { CalendarRange, Clock, ListChecks, Package } from "lucide-react";
import { PageHeader, Tabs } from "@/components/ui";
import { Musaitlikler } from "./Musaitlikler";
import { Paketler } from "./Paketler";
import { Randevular } from "./Randevular";
import { Takvim } from "./Takvim";

// Veli portalı (Bölüm 11) buradan kullanır
export { bosSlotlar, etutTurAd, ogrenciDersiCakisir, ogrenciSonucu } from "./kurallar";

export default function Etut() {
  const [sekme, setSekme] = React.useState<"takvim" | "randevu" | "musait" | "paket">("takvim");
  return (
    <div className="grid gap-6">
      <PageHeader code="09" title="Etüt ve birebir ders" description="Öğretmen müsaitliği şube ile girilir; yönetim veya veli portalından boş slotlara randevu alınır." />
      <Tabs
        value={sekme}
        onChange={setSekme}
        items={[
          { value: "takvim", label: "Takvim", icon: <CalendarRange /> },
          { value: "randevu", label: "Randevular", icon: <ListChecks /> },
          { value: "musait", label: "Müsaitlik", icon: <Clock /> },
          { value: "paket", label: "Özel ders paketleri", icon: <Package /> },
        ]}
      />
      {sekme === "takvim" && <Takvim />}
      {sekme === "randevu" && <Randevular />}
      {sekme === "musait" && <Musaitlikler />}
      {sekme === "paket" && <Paketler />}
    </div>
  );
}
