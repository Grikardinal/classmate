/** Öğretmen ve grup bazında teslim oranları. Öğretmen yalnızca kendi ödevlerinin oranını görür. */
import { Card, CardDescription, CardHeader, CardTitle, Table, Td, Th } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { grupEtiket, personelAdi, useDb } from "@/data/store";
import { teslimOzeti, type TeslimOzeti } from "./kurallar";

function Satir({ ad, o }: { ad: string; o: TeslimOzeti }) {
  return (
    <tr>
      <Td className="font-medium">{ad}</Td>
      <Td className="text-right tabular-nums">{o.verilen}</Td>
      <Td className="text-right tabular-nums">{o.kontrol}</Td>
      <Td className="text-right tabular-nums">{o.eksik}</Td>
      <Td className="text-right tabular-nums">{o.yapmadi}</Td>
      <Td className="text-right tabular-nums font-medium">{o.oran === null ? "—" : `%${Math.round(o.oran * 100)}`}</Td>
    </tr>
  );
}

function Baslik({ ilk }: { ilk: string }) {
  return <thead><tr><Th>{ilk}</Th><Th className="text-right">Verilen</Th><Th className="text-right">Kontrol</Th><Th className="text-right">Eksik</Th><Th className="text-right">Yapmadı</Th><Th className="text-right">Tam teslim</Th></tr></thead>;
}

export default function TeslimOranlari() {
  const d = useDb();
  const { grupGorunur, ogretmenMi, personel } = useOturum();
  const odevler = d.odevler.filter((o) => grupGorunur(o.grupId) && (!ogretmenMi || o.ogretmenId === personel.id));
  const ogretmenler = [...new Set(odevler.map((o) => o.ogretmenId))];
  const gruplar = [...new Set(odevler.map((o) => o.grupId))];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Öğretmen bazında</CardTitle><CardDescription>Verilen ödev sayısı ve teslim oranları</CardDescription></CardHeader>
        <Table><Baslik ilk="Öğretmen" /><tbody>{ogretmenler.map((p) => <Satir key={p} ad={personelAdi(d, p)} o={teslimOzeti(odevler.filter((o) => o.ogretmenId === p))} />)}</tbody></Table>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Grup bazında</CardTitle></CardHeader>
        <Table><Baslik ilk="Grup" /><tbody>{gruplar.map((g) => <Satir key={g} ad={grupEtiket(d, g)} o={teslimOzeti(odevler.filter((o) => o.grupId === g))} />)}</tbody></Table>
      </Card>
    </div>
  );
}
