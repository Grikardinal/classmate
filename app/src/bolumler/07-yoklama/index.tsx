/**
 * Bölüm 07 · Yoklama ve devamsızlık
 * Doküman: docs/bolumler/07-yoklama.md
 */
import * as React from "react";
import { ClipboardCheck, FileBarChart, NotebookPen } from "lucide-react";
import { PageHeader, Tabs } from "@/components/ui";
import { DersKayitlari } from "./DersKayitlari";
import { DevamsizlikRaporu } from "./DevamsizlikRaporu";
import { GunlukDersler } from "./GunlukDersler";
import { YoklamaEkrani } from "./YoklamaEkrani";

export default function Yoklama() {
  const [sekme, setSekme] = React.useState<"bugun" | "rapor" | "kayitlar">("bugun");
  const [acikOturum, setAcikOturum] = React.useState<{ id: string; tarih: string } | null>(null);
  if (acikOturum) return <YoklamaEkrani {...acikOturum} onKapat={() => setAcikOturum(null)} />;
  return (
    <div className="grid gap-6">
      <PageHeader code="07" title="Yoklama" description="Öğretmen 30 saniyede yoklama alır; gelmeyen öğrencinin velisi anında haberdar olur." />
      <Tabs
        value={sekme}
        onChange={setSekme}
        items={[
          { value: "bugun", label: "Dersler", icon: <ClipboardCheck /> },
          { value: "rapor", label: "Devamsızlık raporu", icon: <FileBarChart /> },
          { value: "kayitlar", label: "Öğretmen ders kayıtları", icon: <NotebookPen /> },
        ]}
      />
      {sekme === "bugun" && <GunlukDersler onAc={(id, tarih) => setAcikOturum({ id, tarih })} />}
      {sekme === "rapor" && <DevamsizlikRaporu />}
      {sekme === "kayitlar" && <DersKayitlari />}
    </div>
  );
}
