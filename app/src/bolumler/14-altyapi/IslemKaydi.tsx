/** Bölüm 14 · İşlem kaydı (audit log) */
import * as React from "react";
import { Download, History, Search } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, Input, Select, Table, Td, Th } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { BUGUN, sube, useDb } from "@/data/store";
import { csvOlustur, normalAd } from "@/lib/kurallar";
import { dosyaIndir } from "@/lib/yazdir";

export function IslemKaydi() {
  const d = useDb();
  const { subeGorunur, rol } = useOturum();
  const [ara, setAra] = React.useState("");
  const [tur, setTur] = React.useState("all");
  const turler = [...new Set(d.islemler.map((i) => i.islem))].sort((a, b) => a.localeCompare(b, "tr"));
  // Sunucu yeni satırı sona ekler: en yeni üstte olsun, ilk 100 satırda görünsün
  const liste = [...d.islemler].sort((a, b) => b.zaman.localeCompare(a.zaman)).filter(
    (i) => (rol === "genel-yonetici" ? true : !i.subeId || subeGorunur(i.subeId)) && (tur === "all" || i.islem === tur) && normalAd(`${i.kullanici} ${i.detay}`).includes(normalAd(ara)),
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">İşlem kaydı (audit log)</CardTitle>
        <CardDescription>Kayıt iptali, tahsilat iptali, indirim, yetki ve program değişiklikleri gibi önemli işlemler. Kayıtlar değiştirilemez.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2 pb-4">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Kullanıcı veya detay ara" className="pl-8" value={ara} onChange={(e) => setAra(e.target.value)} />
        </div>
        <Select aria-label="İşlem türü" className="w-56" value={tur} onChange={(e) => setTur(e.target.value)}>
          <option value="all">Tüm işlemler</option>
          {turler.map((t) => <option key={t}>{t}</option>)}
        </Select>
        <Button variant="outline" onClick={() => dosyaIndir(`islem-kaydi-${BUGUN}.csv`, csvOlustur([["Zaman", "Kullanıcı", "İşlem", "Detay", "Şube"], ...liste.map((i) => [i.zaman, i.kullanici, i.islem, i.detay, sube(i.subeId)?.ad ?? "Genel"])]))}>
          <Download /> CSV
        </Button>
      </CardContent>
      {liste.length === 0 ? (
        <CardContent><EmptyState icon={<History />} title="Kayıt yok" text="Filtreye uyan işlem bulunamadı." /></CardContent>
      ) : (
        <Table>
          <thead><tr><Th>Zaman</Th><Th>Kullanıcı</Th><Th>İşlem</Th><Th>Detay</Th><Th>Şube</Th></tr></thead>
          <tbody>
            {liste.slice(0, 100).map((i) => (
              <tr key={i.id}>
                <Td className="whitespace-nowrap tabular-nums text-muted-foreground">{new Date(i.zaman).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</Td>
                <Td className="whitespace-nowrap">{i.kullanici}</Td>
                <Td><Badge variant="outline">{i.islem}</Badge></Td>
                <Td>{i.detay}</Td>
                <Td className="font-mono text-xs">{sube(i.subeId)?.kod ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
