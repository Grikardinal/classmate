/**
 * Bölüm 05 · Finans: ödeme planı, tahsilat ve kasa
 * Doküman: docs/bolumler/05-finans.md — modül varsayılan KAPALI (Bölüm 01 → Modüller)
 * Kurallar: ./kurallar.ts (sunucu aynı kuralları server/politika.ts · finansDenetle içinde uygular). Ayrıntı: README.md
 */
import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { AlarmClock, PieChart, Receipt, Wallet } from "lucide-react";
import { PageHeader, Tabs } from "@/components/ui";
import { Gecikenler } from "./Gecikenler";
import { HizliTahsilat } from "./HizliTahsilat";
import { Kasa } from "./Kasa";
import { Ozet } from "./Ozet";
import type { Sekme } from "./ortak";

export default function Finans() {
  const [params] = useSearchParams();
  const [sekme, setSekme] = React.useState<Sekme>(params.get("veli") ? "tahsilat" : "ozet");
  return (
    <div className="grid gap-6">
      <PageHeader code="05" title="Finans" description="Kim ne kadar borçlu, kim gecikti, kasada ne var — tek bakışta." />
      <Tabs
        value={sekme}
        onChange={setSekme}
        items={[
          { value: "ozet", label: "Özet", icon: <PieChart /> },
          { value: "tahsilat", label: "Hızlı tahsilat", icon: <Receipt /> },
          { value: "geciken", label: "Vadesi geçenler", icon: <AlarmClock /> },
          { value: "kasa", label: "Kasa ve gider", icon: <Wallet /> },
        ]}
      />
      {sekme === "ozet" && <Ozet onGit={setSekme} />}
      {sekme === "tahsilat" && <HizliTahsilat baslangicVeli={params.get("veli")} />}
      {sekme === "geciken" && <Gecikenler />}
      {sekme === "kasa" && <Kasa />}
    </div>
  );
}
