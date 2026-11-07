import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Alert, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, Select, toast } from "@/components/ui";
import { useApp, useOturum } from "@/context/AppContext";
import { guncelle, islemYaz, useDb, yeniId, type DersSaati } from "@/data/store";
import { dersSaatiDogrula, dersSaatiSilmeEngeli, dersSaatleriniSirala, GUN_TIPLERI } from "./kurallar";
import { HataMetni, useSubeTanimYazar } from "./ortak";

const GUN_TIPI_ADI: Record<DersSaati["gunTipi"], string> = { "hafta-ici": "Hafta içi", "hafta-sonu": "Hafta sonu" };

export function DersSaatleri() {
  const { subeId } = useApp();
  const { kapsam, ad } = useOturum();
  const d = useDb();
  const yazabilir = useSubeTanimYazar();
  const subeler = d.subeler.filter((s) => s.aktif && kapsam.includes(s.id));
  const [secili, setSecili] = React.useState(subeId !== "all" && kapsam.includes(subeId) ? subeId : kapsam[0] ?? "");
  React.useEffect(() => {
    if (subeId !== "all" && kapsam.includes(subeId)) setSecili(subeId);
    // kapsam her çizimde yeni dizi; yalnızca üst bar seçimi değişince uygula
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subeId]);
  const [yeni, setYeni] = React.useState<{ gunTipi: DersSaati["gunTipi"]; baslangic: string; bitis: string }>({ gunTipi: "hafta-ici", baslangic: "18:30", bitis: "19:10" });
  const saatler = d.dersSaatleri.filter((h) => h.subeId === secili);
  const hata = dersSaatiDogrula({ id: "", subeId: secili, ...yeni }, d.dersSaatleri);

  if (!secili) return <Alert>Ders saati tanımlamak için kapsamınızda aktif bir şube olmalı.</Alert>;

  const ekle = () => {
    if (hata) return;
    guncelle((x) => {
      x.dersSaatleri = dersSaatleriniSirala([...x.dersSaatleri, { id: yeniId("h"), subeId: secili, gunTipi: yeni.gunTipi, sira: 0, baslangic: yeni.baslangic, bitis: yeni.bitis }], secili);
      islemYaz(x, ad, "Ders saati", `${GUN_TIPI_ADI[yeni.gunTipi]} ${yeni.baslangic}–${yeni.bitis} eklendi`, secili);
    });
  };
  const sil = (h: DersSaati) => {
    const engel = dersSaatiSilmeEngeli(h.id, d.program);
    if (engel) return toast(engel, "uyari");
    guncelle((x) => {
      x.dersSaatleri = dersSaatleriniSirala(x.dersSaatleri.filter((y) => y.id !== h.id), h.subeId);
      islemYaz(x, ad, "Ders saati", `${GUN_TIPI_ADI[h.gunTipi]} ${h.baslangic}–${h.bitis} silindi`, h.subeId);
    });
  };

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Ders saatleri</CardTitle>
          <CardDescription className="mt-1">Şubelerin çalışma saatleri farklı olabilir. Ders programı bu dilimleri kullanır.</CardDescription>
        </div>
        <Select aria-label="Şube" className="w-44" value={secili} onChange={(e) => setSecili(e.target.value)}>
          {subeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
        </Select>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {GUN_TIPLERI.map((tip) => {
          const liste = saatler.filter((h) => h.gunTipi === tip).sort((a, b) => a.sira - b.sira);
          return (
            <div key={tip} className="rounded-md border">
              <p className="border-b px-4 py-2.5 text-sm font-medium">{GUN_TIPI_ADI[tip]}</p>
              <ul className="divide-y">
                {liste.map((h) => (
                  <li key={h.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                    <span className="grid size-6 place-items-center rounded-full bg-muted text-xs font-medium">{h.sira}</span>
                    <span className="flex-1 tabular-nums">{h.baslangic} – {h.bitis}</span>
                    {yazabilir && <Button variant="ghost" size="icon" aria-label={`${h.baslangic}–${h.bitis} sil`} onClick={() => sil(h)}><Trash2 /></Button>}
                  </li>
                ))}
                {liste.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Tanımlı saat yok</li>}
              </ul>
            </div>
          );
        })}
        {yazabilir && (
          <div className="grid gap-2 rounded-md border border-dashed p-3 sm:col-span-2 sm:grid-cols-[10rem_7rem_7rem_auto] sm:items-end">
            <Field label="Gün tipi">
              <Select value={yeni.gunTipi} onChange={(e) => setYeni({ ...yeni, gunTipi: e.target.value as DersSaati["gunTipi"] })}>
                {GUN_TIPLERI.map((t) => <option key={t} value={t}>{GUN_TIPI_ADI[t]}</option>)}
              </Select>
            </Field>
            <Field label="Başlangıç"><Input type="time" value={yeni.baslangic} onChange={(e) => setYeni({ ...yeni, baslangic: e.target.value })} /></Field>
            <Field label="Bitiş"><Input type="time" value={yeni.bitis} onChange={(e) => setYeni({ ...yeni, bitis: e.target.value })} /></Field>
            <Button onClick={ekle} disabled={!!hata}><Plus /> Ekle</Button>
            <HataMetni hata={hata} className="text-xs text-danger sm:col-span-4" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
