import * as React from "react";
import { AlertTriangle, Download } from "lucide-react";
import { Alert, Button, Card, Select, StatCard, Table, Td, Th } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { BUGUN, grupEtiket, ogrenciYoklamalari, sube, tamAd, useDb } from "@/data/store";
import { csvOlustur, devamsizlikOzeti, haftaBasi } from "@/lib/kurallar";
import { dosyaIndir } from "@/lib/yazdir";
import { cn } from "@/lib/utils";
import { raporBaslangici, type RaporDonemi } from "./kurallar";

/* ---------- Devamsızlık raporu ---------- */
export function DevamsizlikRaporu() {
  const d = useDb();
  const { grupGorunur } = useOturum();
  const [donem, setDonem] = React.useState<RaporDonemi>("ay");
  const [grupId, setGrupId] = React.useState("all");
  const bas = raporBaslangici(donem, BUGUN, d.sezonlar.find((z) => z.aktif)?.baslangic);
  const gruplar = d.gruplar.filter((g) => grupGorunur(g.id));
  const satirlar = d.kayitlar
    .filter((k) => k.durum === "aktif" && grupGorunur(k.grupId) && (grupId === "all" || k.grupId === grupId))
    .map((k) => {
      const o = d.ogrenciler.find((x) => x.id === k.ogrenciId)!;
      const oz = devamsizlikOzeti(ogrenciYoklamalari(d, o.id, bas, BUGUN).map((x) => x.durum));
      const buHafta = ogrenciYoklamalari(d, o.id, haftaBasi(BUGUN), BUGUN).filter((x) => x.durum === "gelmedi").length;
      return { k, o, oz, buHafta };
    })
    .sort((a, b) => b.oz.oran - a.oz.oran || b.oz.gelmedi - a.oz.gelmedi);
  const esik = satirlar.filter((s) => s.buHafta >= d.ayarlar.devamsizlikEsigi);
  const toplam = devamsizlikOzeti(satirlar.flatMap((s) => ogrenciYoklamalari(d, s.o.id, bas, BUGUN).map((x) => x.durum)));

  const indir = () =>
    dosyaIndir(
      `devamsizlik-${donem}-${BUGUN}.csv`,
      csvOlustur([
        ["Öğrenci", "Şube", "Grup", "Ders sayısı", "Gelmedi", "İzinli", "Geç", "Devamsızlık %"],
        ...satirlar.map((s) => [tamAd(s.o), sube(s.k.subeId)?.ad ?? "", grupEtiket(d, s.k.grupId), s.oz.toplam, s.oz.gelmedi, s.oz.izinli, s.oz.gec, Math.round(s.oz.oran * 1000) / 10]),
      ]),
    );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select aria-label="Dönem" className="w-40" value={donem} onChange={(e) => setDonem(e.target.value as typeof donem)}>
          <option value="hafta">Bu hafta</option>
          <option value="ay">Bu ay</option>
          <option value="sezon">Sezon başından</option>
        </Select>
        <Select aria-label="Grup" className="w-40" value={grupId} onChange={(e) => setGrupId(e.target.value)}>
          <option value="all">Tüm gruplar</option>
          {gruplar.map((g) => <option key={g.id} value={g.id}>{grupEtiket(d, g.id)}</option>)}
        </Select>
        <Button variant="outline" className="ml-auto" onClick={indir}><Download /> Excel (CSV)</Button>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Devamsızlık oranı" value={`%${Math.round(toplam.oran * 1000) / 10}`} hint="İzinliler hariç" />
        <StatCard label="Gelmedi" value={toplam.gelmedi} tone="danger" />
        <StatCard label="İzinli" value={toplam.izinli} hint={`%${Math.round(toplam.izinliOran * 1000) / 10}`} />
        <StatCard label="Geç geldi" value={toplam.gec} tone="warning" />
      </div>
      {esik.length > 0 && (
        <Alert tone="danger" icon={<AlertTriangle />}>
          Bu hafta {d.ayarlar.devamsizlikEsigi}+ derse gelmeyenler: {esik.map((s) => `${tamAd(s.o)} (${s.buHafta})`).join(", ")}
        </Alert>
      )}
      <Card>
        <Table>
          <thead><tr><Th>Öğrenci</Th><Th>Grup</Th><Th className="text-right">Ders</Th><Th className="text-right">Gelmedi</Th><Th className="text-right">İzinli</Th><Th className="text-right">Geç</Th><Th className="w-40">Oran</Th></tr></thead>
          <tbody>
            {satirlar.map((s) => (
              <tr key={s.k.id}>
                <Td className="font-medium">{tamAd(s.o)}</Td>
                <Td>{grupEtiket(d, s.k.grupId)}</Td>
                <Td className="text-right tabular-nums">{s.oz.toplam}</Td>
                <Td className="text-right tabular-nums">{s.oz.gelmedi}</Td>
                <Td className="text-right tabular-nums">{s.oz.izinli}</Td>
                <Td className="text-right tabular-nums">{s.oz.gec}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className={cn("h-full rounded-full", s.oz.oran >= 0.15 ? "bg-danger" : s.oz.oran >= 0.08 ? "bg-warning" : "bg-primary")} style={{ width: `${Math.min(s.oz.oran * 4, 1) * 100}%` }} />
                    </div>
                    <span className="w-10 text-right text-xs tabular-nums">%{Math.round(s.oz.oran * 100)}</span>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
