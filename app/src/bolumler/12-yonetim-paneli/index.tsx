/**
 * Bölüm 12 · Yönetim paneli (dashboard) ve raporlar
 * Doküman: docs/bolumler/12-yonetim-paneli-ve-raporlar.md · Hesaplar: kurallar.ts · Rapor tanımları: raporTanimlari.ts
 */
import * as React from "react";
import { FileBarChart, LayoutDashboard } from "lucide-react";
import { Tabs } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { KarsilamaBandi } from "./KarsilamaBandi";
import { OgretmenPaneli } from "./OgretmenPaneli";
import { Panel } from "./Panel";
import { Raporlar } from "./Raporlar";

export { selamla } from "./kurallar";

export default function YonetimPaneli() {
  const { ogretmenMi, yetki } = useOturum();
  const [sekme, setSekme] = React.useState<"panel" | "rapor">("panel");
  if (ogretmenMi) return <OgretmenPaneli />;
  const raporAcik = yetki("12");
  return (
    <div className="grid gap-6">
      <KarsilamaBandi />
      {raporAcik && (
        <Tabs
          value={sekme}
          onChange={setSekme}
          items={[
            { value: "panel", label: "Panel", icon: <LayoutDashboard /> },
            { value: "rapor", label: "Raporlar", icon: <FileBarChart /> },
          ]}
        />
      )}
      {sekme === "rapor" && raporAcik ? <Raporlar /> : <Panel />}
    </div>
  );
}
