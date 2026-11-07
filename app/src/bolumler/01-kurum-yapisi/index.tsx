/**
 * Bölüm 01 · Kurum yapısı ve tanımlar
 * Doküman: docs/bolumler/01-kurum-yapisi-ve-tanimlar.md · Ayrıntı: bu klasördeki README.md
 * Tüm tanımlar sunucuda saklanır; kurum geneli tanımları yalnızca genel yönetici değiştirebilir.
 * Saf iş kuralları kurallar.ts'tedir; sunucu (server/politika.ts) aynı kuralları yeniden uygular.
 */
import * as React from "react";
import { BookOpen, Building2, CalendarRange, Clock, Coins, DoorOpen, MapPin, ToggleRight, Users } from "lucide-react";
import { PageHeader, Tabs } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { KurumBilgileri } from "./KurumBilgileri";
import { Subeler } from "./Subeler";
import { Sezonlar } from "./Sezonlar";
import { Gruplar } from "./Gruplar";
import { Dersler } from "./Dersler";
import { Derslikler } from "./Derslikler";
import { DersSaatleri } from "./DersSaatleri";
import { FiyatListesi } from "./FiyatListesi";
import { Moduller } from "./Moduller";

type Sekme = "kurum" | "subeler" | "sezonlar" | "gruplar" | "dersler" | "derslikler" | "saatler" | "fiyat" | "moduller";

export default function KurumYapisi() {
  const { moduller } = useApp();
  const [secilen, setSekme] = React.useState<Sekme>("kurum");
  // Finans modülü başka bir oturumda kapatılırsa fiyat sekmesi açık kalmasın
  const sekme: Sekme = secilen === "fiyat" && !moduller.finans ? "kurum" : secilen;
  return (
    <div className="grid gap-6">
      <PageHeader code="01" title="Kurum ve tanımlar" description="Şubeler, sezonlar, gruplar, dersler ve derslikler. Diğer tüm bölümler bu tanımları kullanır." />
      <Tabs
        value={sekme}
        onChange={setSekme}
        items={[
          { value: "kurum", label: "Kurum", icon: <Building2 /> },
          { value: "subeler", label: "Şubeler", icon: <MapPin /> },
          { value: "sezonlar", label: "Sezonlar", icon: <CalendarRange /> },
          { value: "gruplar", label: "Gruplar", icon: <Users /> },
          { value: "dersler", label: "Dersler", icon: <BookOpen /> },
          { value: "derslikler", label: "Derslikler", icon: <DoorOpen /> },
          { value: "saatler", label: "Ders saatleri", icon: <Clock /> },
          ...(moduller.finans ? [{ value: "fiyat" as const, label: "Fiyat listesi", icon: <Coins /> }] : []),
          { value: "moduller", label: "Modüller", icon: <ToggleRight /> },
        ]}
      />
      {sekme === "kurum" && <KurumBilgileri />}
      {sekme === "subeler" && <Subeler />}
      {sekme === "sezonlar" && <Sezonlar />}
      {sekme === "gruplar" && <Gruplar />}
      {sekme === "dersler" && <Dersler />}
      {sekme === "derslikler" && <Derslikler />}
      {sekme === "saatler" && <DersSaatleri />}
      {sekme === "fiyat" && <FiyatListesi />}
      {sekme === "moduller" && <Moduller />}
    </div>
  );
}
