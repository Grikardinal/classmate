import * as React from "react";
import { Archive, ArchiveRestore, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, Select, Table, Td, Th, toast } from "@/components/ui";
import { subeKodu, useApp, useOturum, useSubeFiltre } from "@/context/AppContext";
import { guncelle, islemYaz, useDb, yeniId, type Derslik } from "@/data/store";
import { derslikDogrula, derslikSilmeEngeli, kapasiteDuzelt, tanimAktif } from "./kurallar";
import { cn } from "@/lib/utils";
import { HataMetni, useSubeTanimYazar } from "./ortak";

export function Derslikler() {
  const filtre = useSubeFiltre();
  const { subeId } = useApp();
  const { kapsam, ad } = useOturum();
  const d = useDb();
  const yazabilir = useSubeTanimYazar();
  const liste = d.derslikler.filter((x) => filtre(x.subeId));
  const aktifSezon = d.sezonlar.find((s) => s.aktif)?.id;
  const [f, setF] = React.useState({ subeId: subeId !== "all" && kapsam.includes(subeId) ? subeId : kapsam[0] ?? "", ad: "", kapasite: "14" });
  const yeniDerslik = { subeId: f.subeId, ad: f.ad.trim(), kapasite: Number(f.kapasite) };
  const hata = derslikDogrula(yeniDerslik, d.derslikler);

  const ekle = () => {
    if (hata) return;
    guncelle((x) => {
      x.derslikler.push({ id: yeniId("d"), ...yeniDerslik, aktif: true });
      islemYaz(x, ad, "Derslik", `${yeniDerslik.ad} eklendi`, yeniDerslik.subeId);
    });
    setF({ ...f, ad: "" });
  };
  const sil = (dl: Derslik) => {
    const engel = derslikSilmeEngeli(dl.id, d);
    if (engel) return toast(engel, "uyari");
    guncelle((x) => {
      x.derslikler = x.derslikler.filter((y) => y.id !== dl.id);
      islemYaz(x, ad, "Derslik", `${dl.ad} silindi`, dl.subeId);
    });
  };
  /** Kullanılmış derslik silinmez, pasife alınır: geçmiş program ve yoklamalar bozulmaz, yeni atamada seçilemez. */
  const aktiflikDegistir = (dl: Derslik) => {
    const aktif = !tanimAktif(dl);
    guncelle((x) => {
      x.derslikler = x.derslikler.map((z) => (z.id === dl.id ? { ...z, aktif } : z));
      islemYaz(x, ad, "Derslik", `${dl.ad} ${aktif ? "aktife alındı" : "pasife alındı"}`, dl.subeId);
    });
  };
  const kapasiteKaydet = (dl: Derslik, kapasite: number) => {
    if (kapasite === dl.kapasite) return;
    guncelle((x) => {
      x.derslikler = x.derslikler.map((z) => (z.id === dl.id ? { ...z, kapasite } : z));
      islemYaz(x, ad, "Derslik", `${dl.ad} kapasitesi ${kapasite} yapıldı`, dl.subeId);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Derslikler</CardTitle>
        <CardDescription>Şubeye özel. Üst bardaki şube seçicisine göre filtrelenir. Ders programında kullanılmış derslik silinemez; pasife alınır (geçmiş kayıtlar korunur, yeni atamada seçilemez).</CardDescription>
      </CardHeader>
      <Table>
        <thead><tr><Th>Şube</Th><Th>Derslik</Th><Th>Kapasite</Th><Th>Kullanan gruplar (aktif sezon)</Th><Th /></tr></thead>
        <tbody>
          {liste.map((x) => {
            const aktif = tanimAktif(x);
            const silmeEngeli = derslikSilmeEngeli(x.id, d);
            return (
            <tr key={x.id} className={cn(!aktif && "opacity-60")}>
              <Td className="font-mono text-xs text-muted-foreground">{subeKodu(d, x.subeId)}</Td>
              <Td className="font-medium">
                <span className={cn(!aktif && "text-muted-foreground")}>{x.ad}</span>
                {!aktif && <Badge variant="outline" className="ml-2">Pasif</Badge>}
              </Td>
              <Td><KapasiteHucresi deger={x.kapasite} disabled={!yazabilir} etiket={`${x.ad} kapasitesi`} onKaydet={(k) => kapasiteKaydet(x, k)} /></Td>
              <Td><div className="flex flex-wrap gap-1">{d.gruplar.filter((g) => g.derslikId === x.id && g.sezonId === aktifSezon).map((g) => <Badge key={g.id} variant="outline">{g.ad}</Badge>)}</div></Td>
              <Td className="whitespace-nowrap text-right">
                {yazabilir && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => aktiflikDegistir(x)} title={aktif ? "Yeni ders programı ve grup atamasında seçilemez; geçmiş kayıtlar korunur." : undefined}>
                      {aktif ? <><Archive /> Pasife al</> : <><ArchiveRestore /> Aktife al</>}
                    </Button>
                    <span title={silmeEngeli ?? undefined} className="inline-block"><Button variant="ghost" size="icon" aria-label={silmeEngeli ? `${x.ad} silinemez: ${silmeEngeli}` : `${x.ad} sil`} disabled={!!silmeEngeli} onClick={() => sil(x)}><Trash2 /></Button></span>
                  </>
                )}
              </Td>
            </tr>
            );
          })}
          {liste.length === 0 && (
            <tr><Td colSpan={5} className="py-6 text-center text-sm text-muted-foreground">Tanımlı derslik yok</Td></tr>
          )}
        </tbody>
      </Table>
      {yazabilir && kapsam.length > 0 && (
        <CardContent className="grid gap-2 pt-4 sm:grid-cols-[10rem_1fr_6rem_auto] sm:items-end">
          <Field label="Şube"><Select value={f.subeId} onChange={(e) => setF({ ...f, subeId: e.target.value })}>{d.subeler.filter((s) => kapsam.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}</Select></Field>
          <Field label="Yeni derslik"><Input value={f.ad} onChange={(e) => setF({ ...f, ad: e.target.value })} placeholder="Derslik 3" /></Field>
          <Field label="Kapasite"><Input type="number" min={1} step={1} value={f.kapasite} onChange={(e) => setF({ ...f, kapasite: e.target.value })} /></Field>
          <Button onClick={ekle} disabled={!!hata}><Plus /> Ekle</Button>
          <HataMetni hata={f.ad ? hata : null} className="text-xs text-danger sm:col-span-4" />
        </CardContent>
      )}
    </Card>
  );
}

/** Kapasite yazılırken yerelde tutulur; odaktan çıkınca veya Enter'da geçerli tam sayıya çevrilip kaydedilir. */
function KapasiteHucresi({ deger, disabled, etiket, onKaydet }: { deger: number; disabled: boolean; etiket: string; onKaydet: (k: number) => void }) {
  const [metin, setMetin] = React.useState(String(deger));
  React.useEffect(() => setMetin(String(deger)), [deger]);
  const bitir = () => {
    const k = kapasiteDuzelt(metin);
    setMetin(String(k));
    onKaydet(k);
  };
  return (
    <Input
      type="number"
      min={1}
      step={1}
      aria-label={etiket}
      disabled={disabled}
      className="h-8 w-20"
      value={metin}
      onChange={(e) => setMetin(e.target.value)}
      onBlur={bitir}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}
