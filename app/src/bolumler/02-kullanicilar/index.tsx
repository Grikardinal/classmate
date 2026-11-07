/**
 * Bölüm 02 · Kullanıcılar, roller ve yetkiler
 * Doküman: docs/bolumler/02-kullanicilar-ve-yetkiler.md · Açıklama: README.md
 * Saf kurallar kurallar.ts'te (sunucu da kullanır); sekmeler ayrı dosyalarda.
 */
import * as React from "react";
import { History, ShieldCheck, UserCog, Users } from "lucide-react";
import { PageHeader, Tabs } from "@/components/ui";
import { PersonelHesaplari } from "./PersonelHesaplari";
import { VeliHesaplari } from "./VeliHesaplari";
import { RolYetkileri } from "./RolYetkileri";
import { GirisGecmisi } from "./GirisGecmisi";

type Sekme = "personel" | "veli" | "roller" | "giris";

export default function Kullanicilar() {
  const [sekme, setSekme] = React.useState<Sekme>("personel");
  return (
    <div className="grid gap-6">
      <PageHeader
        code="02"
        title="Kullanıcılar ve yetkiler"
        description="Yetki = rol + şube kapsamı. Her kullanıcı yalnızca kendi şube(ler)inin verisini görür."
      />
      <Tabs
        value={sekme}
        onChange={setSekme}
        items={[
          { value: "personel", label: "Personel hesapları", icon: <UserCog /> },
          { value: "veli", label: "Veli hesapları", icon: <Users /> },
          { value: "roller", label: "Rol yetkileri", icon: <ShieldCheck /> },
          { value: "giris", label: "Giriş geçmişi", icon: <History /> },
        ]}
      />
      {sekme === "personel" && <PersonelHesaplari />}
      {sekme === "veli" && <VeliHesaplari />}
      {sekme === "roller" && <RolYetkileri />}
      {sekme === "giris" && <GirisGecmisi />}
    </div>
  );
}
