/**
 * Bölüm 14 · Teknik altyapı, güvenlik ve KVKK
 * Doküman: docs/bolumler/14-altyapi-guvenlik-kvkk.md · Kurallar: ./kurallar.ts
 */
import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { DatabaseBackup, FileUp, History, Settings2, ShieldCheck } from "lucide-react";
import { PageHeader, Tabs } from "@/components/ui";
import { DisaAktarma } from "./DisaAktarma";
import { AktarmaSecici } from "./IceAktarma";
import { IslemKaydi } from "./IslemKaydi";
import { Kvkk } from "./Kvkk";
import { SistemAyarlari } from "./SistemAyarlari";

const SEKMELER = ["ice", "disa", "islem", "kvkk", "ayar"] as const;
type Sekme = (typeof SEKMELER)[number];

export default function Altyapi() {
  const [params] = useSearchParams();
  const istenen = params.get("sekme") as Sekme;
  const [sekme, setSekme] = React.useState<Sekme>(SEKMELER.includes(istenen) ? istenen : "ice");
  return (
    <div className="grid gap-6">
      <PageHeader code="14" title="Veri, güvenlik ve KVKK" description="Excel'den içe aktarma, yedek ve dışa aktarma, işlem kaydı, kişisel veri araçları ve sistem ayarları." />
      <Tabs
        value={sekme}
        onChange={setSekme}
        items={[
          { value: "ice", label: "Excel'den aktar", icon: <FileUp /> },
          { value: "disa", label: "Yedek ve dışa aktarma", icon: <DatabaseBackup /> },
          { value: "islem", label: "İşlem kaydı", icon: <History /> },
          { value: "kvkk", label: "KVKK", icon: <ShieldCheck /> },
          { value: "ayar", label: "Sistem ayarları", icon: <Settings2 /> },
        ]}
      />
      {sekme === "ice" && <AktarmaSecici />}
      {sekme === "disa" && <DisaAktarma />}
      {sekme === "islem" && <IslemKaydi />}
      {sekme === "kvkk" && <Kvkk />}
      {sekme === "ayar" && <SistemAyarlari />}
    </div>
  );
}
