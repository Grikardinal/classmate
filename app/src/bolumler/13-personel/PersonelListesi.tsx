import * as React from "react";
import { Plus, Search, Users } from "lucide-react";
import { Avatar, Badge, Button, Card, CardContent, Input, Select, StatCard, Switch, Table, Td, Th } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { dersAdi, rolAdlari, sube, tamAd, useDb, type Rol } from "@/data/store";
import { bolumYetkisi } from "../02-kullanicilar/kurallar";
import { haftalikDersler } from "./ortak";
import { PersonelEkle } from "./PersonelEkle";
import { PersonelKarti } from "./PersonelKarti";

export function PersonelListesi() {
  const d = useDb();
  const { subeGorunur, rol } = useOturum();
  const [ara, setAra] = React.useState("");
  const [gorev, setGorev] = React.useState<Rol | "all">("all");
  const [pasif, setPasif] = React.useState(false);
  const [secili, setSecili] = React.useState<string | null>(null);
  const [yeni, setYeni] = React.useState(false);
  const ekleyebilir = rol === "genel-yonetici" || bolumYetkisi(d.rolYetkileri, rol, "13");
  const liste = d.personel
    .filter((p) => p.subeIds.some((s) => subeGorunur(s)) || p.gorev === "genel-yonetici")
    .filter((p) => (pasif || p.aktif) && (gorev === "all" || p.gorev === gorev) && tamAd(p).toLocaleLowerCase("tr").includes(ara.toLocaleLowerCase("tr")));
  const ogretmenler = liste.filter((p) => p.gorev === "ogretmen" && p.aktif);

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Aktif personel" value={liste.filter((p) => p.aktif).length} icon={<Users />} />
        <StatCard label="Öğretmen" value={ogretmenler.length} />
        <StatCard label="Birden çok şubede" value={ogretmenler.filter((p) => p.subeIds.length > 1).length} />
        <StatCard label="Haftalık toplam ders" value={ogretmenler.reduce((s, p) => s + haftalikDersler(d, p.id).length, 0)} />
      </div>
      <Card>
        <CardContent className="flex flex-wrap gap-2 p-4">
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="İsim ara" className="pl-8" value={ara} onChange={(e) => setAra(e.target.value)} />
          </div>
          <Select aria-label="Görev" className="w-44" value={gorev} onChange={(e) => setGorev(e.target.value as Rol | "all")}>
            <option value="all">Tüm görevler</option>
            {Object.entries(rolAdlari).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <div className="flex items-center gap-2">
            <Switch label="Pasifleri göster" checked={pasif} onCheckedChange={setPasif} />
            <span className="text-sm">Pasifler</span>
          </div>
          {ekleyebilir && <Button onClick={() => setYeni(true)}><Plus /> Personel ekle</Button>}
        </CardContent>
        <Table>
          <thead>
            <tr><Th>Personel</Th><Th>Görev</Th><Th>Branş</Th><Th>Şubeler</Th><Th className="text-right">Haftalık ders</Th><Th>Durum</Th></tr>
          </thead>
          <tbody>
            {liste.map((p) => (
              <tr key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSecili(p.id)}>
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar ad={tamAd(p)} className="size-8" />
                    <div>
                      <p className="font-medium">{tamAd(p)}</p>
                      <p className="text-xs text-muted-foreground">{p.telefon}</p>
                    </div>
                  </div>
                </Td>
                <Td>{rolAdlari[p.gorev]}</Td>
                <Td>{p.dersIds.map(dersAdi).join(", ") || "—"}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {p.subeIds.map((s) => <Badge key={s} variant={s === p.anaSubeId ? "default" : "outline"}>{sube(s)?.kod}</Badge>)}
                  </div>
                </Td>
                <Td className="text-right tabular-nums">{p.gorev === "ogretmen" ? haftalikDersler(d, p.id).length : "—"}</Td>
                <Td><Badge variant={p.aktif ? "success" : "secondary"}>{p.aktif ? "Aktif" : "Pasif"}</Badge></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      {secili && <PersonelKarti id={secili} onClose={() => setSecili(null)} />}
      {ekleyebilir && <PersonelEkle open={yeni} onClose={() => setYeni(false)} />}
    </div>
  );
}
