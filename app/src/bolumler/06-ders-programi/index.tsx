/**
 * Bölüm 06 · Ders programı
 * Doküman: docs/bolumler/06-ders-programi.md · Açıklama: README.md
 */
import * as React from "react";
import { CalendarDays, CalendarOff } from "lucide-react";
import { PageHeader, Tabs } from "@/components/ui";
import { HaftalikProgram } from "./HaftalikProgram";
import { TatilIptal } from "./TatilIptal";

export default function DersProgrami() {
  const [sekme, setSekme] = React.useState<"program" | "tatil">("program");
  return (
    <div className="grid gap-6">
      <PageHeader code="06" title="Ders programı" description="Haftalık şablondan her gün için ders oturumları üretilir; yoklama bu oturumlara bağlanır." />
      <Tabs
        value={sekme}
        onChange={setSekme}
        items={[
          { value: "program", label: "Haftalık program", icon: <CalendarDays /> },
          { value: "tatil", label: "Tatil ve iptaller", icon: <CalendarOff /> },
        ]}
      />
      {sekme === "program" ? <HaftalikProgram /> : <TatilIptal />}
    </div>
  );
}
