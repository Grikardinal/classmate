import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, Select, Table, Td, Th, toast } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { gunAdlari, gunKisa } from "@/data/mock";
import { guncelle, islemYaz, personelAdi, sube, tanimlar, useDb, yeniId } from "@/data/store";
import { dakika } from "@/lib/kurallar";
import { SLOT_DK, musaitlikEngeli } from "./kurallar";

export function Musaitlikler() {
  const d = useDb();
  const { subeGorunur, ogretmenMi, personel, kapsam, ad } = useOturum();
  const ogretmenler = d.personel.filter((p) => p.gorev === "ogretmen" && p.aktif && (ogretmenMi ? p.id === personel.id : p.subeIds.some((s) => subeGorunur(s))));
  const [f, setF] = React.useState({ ogretmenId: ogretmenler[0]?.id ?? "", subeId: "", gun: 1, bas: "14:00", bit: "16:00" });
  const ogr = d.personel.find((p) => p.id === f.ogretmenId);
  const subeSecenek = tanimlar().subeler.filter((s) => ogr?.subeIds.includes(s.id) && kapsam.includes(s.id));
  const subeId = f.subeId || subeSecenek[0]?.id || "";
  const taslak = { id: "__yeni", ogretmenId: f.ogretmenId, subeId, gun: f.gun, bas: f.bas, bit: f.bit };
  const engel = musaitlikEngeli(taslak, { musaitlikler: d.musaitlikler, personel: d.personel, subeler: tanimlar().subeler });
  const liste = d.musaitlikler.filter((m) => subeGorunur(m.subeId) && (!ogretmenMi || m.ogretmenId === personel.id)).sort((a, b) => a.gun - b.gun || a.bas.localeCompare(b.bas));

  const ekle = () => {
    if (engel) return;
    guncelle((x) => {
      x.musaitlikler.push({ ...taslak, id: yeniId("mu") });
      islemYaz(x, ad, "Müsaitlik", `${personelAdi(x, f.ogretmenId)} ${gunKisa[f.gun]} ${f.bas}–${f.bit} ${sube(subeId)?.kod}`, subeId);
    });
    toast("Müsaitlik eklendi.");
  };
  const sil = (m: (typeof liste)[number]) =>
    guncelle((x) => {
      x.musaitlikler = x.musaitlikler.filter((y) => y.id !== m.id);
      islemYaz(x, ad, "Müsaitlik silindi", `${personelAdi(x, m.ogretmenId)} ${gunKisa[m.gun]} ${m.bas}–${m.bit} ${sube(m.subeId)?.kod}`, m.subeId);
    });

  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
      <Card className="self-start">
        <CardHeader><CardTitle className="text-base">Müsaitlik ekle</CardTitle><CardDescription>Örn. Salı 17–19, Merkez</CardDescription></CardHeader>
        <CardContent className="grid gap-3">
          <Field label="Öğretmen">
            <Select value={f.ogretmenId} disabled={ogretmenMi} onChange={(e) => setF({ ...f, ogretmenId: e.target.value, subeId: "" })}>
              {ogretmenler.map((p) => <option key={p.id} value={p.id}>{p.ad} {p.soyad}</option>)}
            </Select>
          </Field>
          <Field label="Şube">
            <Select value={subeId} onChange={(e) => setF({ ...f, subeId: e.target.value })}>
              {subeSecenek.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
            </Select>
          </Field>
          <Field label="Gün">
            <Select value={f.gun} onChange={(e) => setF({ ...f, gun: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5, 6, 7].map((g) => <option key={g} value={g}>{gunAdlari[g]}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Başlangıç"><Input type="time" value={f.bas} onChange={(e) => setF({ ...f, bas: e.target.value })} /></Field>
            <Field label="Bitiş"><Input type="time" value={f.bit} onChange={(e) => setF({ ...f, bit: e.target.value })} /></Field>
          </div>
          {engel && f.ogretmenId && <p className="text-xs text-danger">{engel}</p>}
          <Button onClick={ekle} disabled={!!engel}><Plus /> Ekle</Button>
        </CardContent>
      </Card>
      <Card>
        <Table>
          <thead><tr><Th>Öğretmen</Th><Th>Gün</Th><Th>Saat</Th><Th>Şube</Th><Th className="text-right">Slot</Th><Th /></tr></thead>
          <tbody>
            {liste.map((m) => (
              <tr key={m.id}>
                <Td className="font-medium">{personelAdi(d, m.ogretmenId)}</Td>
                <Td>{gunAdlari[m.gun]}</Td>
                <Td className="tabular-nums">{m.bas}–{m.bit}</Td>
                <Td>{sube(m.subeId)?.ad}</Td>
                <Td className="text-right tabular-nums">{Math.floor((dakika(m.bit) - dakika(m.bas)) / SLOT_DK)}</Td>
                <Td className="text-right"><Button variant="ghost" size="icon" aria-label="Sil" onClick={() => sil(m)}><Trash2 /></Button></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
