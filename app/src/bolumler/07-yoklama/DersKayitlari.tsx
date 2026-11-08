import * as React from "react";
import { Download } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Select, Table, Td, Th } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { BUGUN, dersAdi, grupEtiket, personelAdi, useDb } from "@/data/store";
import { csvOlustur, tarihEkle } from "@/lib/kurallar";
import { dosyaIndir } from "@/lib/yazdir";

/* ---------- Öğretmen ders kayıtları ---------- */
export function DersKayitlari() {
  const d = useDb();
  const { grupGorunur, ogretmenMi, personel } = useOturum();
  const [ogretmenId, setOgretmenId] = React.useState(ogretmenMi ? personel.id : "all");
  const [bas, setBas] = React.useState(tarihEkle(BUGUN, -13));
  const kayitlar = Object.values(d.yoklamalar)
    .filter((y) => y.tarih >= bas && grupGorunur(y.grupId) && (ogretmenId === "all" || y.ogretmenId === ogretmenId))
    .sort((a, b) => b.tarih.localeCompare(a.tarih) || b.kayitZamani.localeCompare(a.kayitZamani));
  const ogretmenler = d.personel.filter((p) => p.gorev === "ogretmen");
  const indir = () =>
    dosyaIndir(
      `ders-kayitlari-${BUGUN}.csv`,
      csvOlustur([
        ["Tarih", "Grup", "Ders", "Öğretmen", "Konu", "Katılım"],
        ...kayitlar.map((y) => {
          const p = d.program.find((x) => x.id === y.satirId);
          const v = Object.values(y.durumlar);
          return [y.tarih, grupEtiket(d, y.grupId), p ? dersAdi(p.dersId) : "", personelAdi(d, y.ogretmenId), y.konu, `${v.filter((x) => x !== "gelmedi").length}/${v.length}`];
        }),
      ]),
    );
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-end justify-between gap-3">
        <div>
          <CardTitle className="text-base">Öğretmen ders kayıtları</CardTitle>
          <CardDescription className="mt-1">Hangi ders işlendi, hangi konu anlatıldı. Hak ediş hesabı bu kayıtlara dayanır (Bölüm 13).</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select aria-label="Öğretmen" className="w-44" value={ogretmenId} disabled={ogretmenMi} onChange={(e) => setOgretmenId(e.target.value)}>
            <option value="all">Tüm öğretmenler</option>
            {ogretmenler.map((p) => <option key={p.id} value={p.id}>{p.ad} {p.soyad}</option>)}
          </Select>
          <Input type="date" aria-label="Başlangıç" className="w-40" value={bas} onChange={(e) => setBas(e.target.value)} />
          <Button variant="outline" onClick={indir}><Download /> CSV</Button>
        </div>
      </CardHeader>
      <Table>
        <thead><tr><Th>Tarih</Th><Th>Grup / ders</Th><Th>Öğretmen</Th><Th>Konu</Th><Th className="text-right">Katılım</Th></tr></thead>
        <tbody>
          {kayitlar.slice(0, 80).map((y) => {
            const p = d.program.find((x) => x.id === y.satirId);
            const v = Object.values(y.durumlar);
            return (
              <tr key={y.oturumId}>
                <Td className="whitespace-nowrap tabular-nums">{new Date(y.tarih + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short", weekday: "short" })}</Td>
                <Td>{grupEtiket(d, y.grupId)} · {p ? dersAdi(p.dersId) : ""}</Td>
                <Td>{personelAdi(d, y.ogretmenId)}</Td>
                <Td className="text-muted-foreground">{y.konu || "—"}</Td>
                <Td className="text-right tabular-nums">{v.filter((x) => x !== "gelmedi").length}/{v.length}</Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      {kayitlar.length === 0 && <CardContent><p className="p-4 text-sm text-muted-foreground">Kayıt yok.</p></CardContent>}
    </Card>
  );
}
