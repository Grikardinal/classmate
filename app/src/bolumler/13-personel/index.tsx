/**
 * Bölüm 13 · Personel ve öğretmen yönetimi
 * Doküman: docs/bolumler/13-personel.md · Açıklama: README.md
 * Personel kartı MVP; hak ediş v2 ve ayrı modül anahtarıyla (varsayılan kapalı).
 */
import * as React from "react";
import { Calculator, Users } from "lucide-react";
import { PageHeader, Tabs } from "@/components/ui";
import { useApp, useOturum } from "@/context/AppContext";
import { useDb } from "@/data/store";
import { bolumYetkisi } from "../02-kullanicilar/kurallar";
import { HakEdis } from "./HakEdis";
import { PersonelListesi } from "./PersonelListesi";

export default function PersonelBolumu() {
  const d = useDb();
  const { moduller } = useApp();
  const { rol } = useOturum();
  const [sekme, setSekme] = React.useState<"liste" | "hakedis">("liste");
  const hakedisGorunur = moduller.hakedis && (rol === "genel-yonetici" || (rol === "sube-muduru" && bolumYetkisi(d.rolYetkileri, rol, "13")));
  return (
    <div className="grid gap-6">
      <PageHeader code="13" title="Personel" description="Öğretmen ve personel kartları, şube ve grup atamaları." />
      {hakedisGorunur && (
        <Tabs
          value={sekme}
          onChange={setSekme}
          items={[
            { value: "liste", label: "Personel", icon: <Users /> },
            { value: "hakedis", label: moduller.finans ? "Hak ediş" : "Ders sayısı raporu", icon: <Calculator /> },
          ]}
        />
      )}
      {sekme === "hakedis" && hakedisGorunur ? <HakEdis /> : <PersonelListesi />}
    </div>
  );
}
