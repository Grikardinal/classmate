/**
 * Bölüm 08 · Ödev takibi (v2) — Ödev modülü açıkken görünür
 * Doküman: docs/bolumler/08-odev-takibi.md · Kurallar: ./kurallar.ts
 */
import * as React from "react";
import { BarChart3, ClipboardList, Plus } from "lucide-react";
import { Button, PageHeader, Tabs } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import OdevListesi from "./OdevListesi";
import TeslimOranlari from "./TeslimOranlari";
import YeniOdev from "./YeniOdev";

export default function Odevler() {
  const [sekme, setSekme] = React.useState<"liste" | "oran">("liste");
  const [yeni, setYeni] = React.useState(false);
  const { ogretmenMi, yetki } = useOturum();
  return (
    <div className="grid gap-6">
      <PageHeader
        code="08"
        title="Ödevler"
        description="Öğretmenin verdiği ödevi veli görür; teslim durumu derste hızlıca işaretlenir. Puanlama yok."
        actions={(ogretmenMi || yetki("08")) && <Button onClick={() => setYeni(true)}><Plus /> Yeni ödev</Button>}
      />
      <Tabs
        value={sekme}
        onChange={setSekme}
        items={[
          { value: "liste", label: "Ödevler", icon: <ClipboardList /> },
          { value: "oran", label: "Teslim oranları", icon: <BarChart3 /> },
        ]}
      />
      {sekme === "liste" ? <OdevListesi /> : <TeslimOranlari />}
      <YeniOdev open={yeni} onClose={() => setYeni(false)} />
    </div>
  );
}
