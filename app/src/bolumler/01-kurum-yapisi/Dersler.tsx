import * as React from "react";
import { Plus } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, Switch } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { guncelle, islemYaz, useDb, yeniId, type Ders } from "@/data/store";
import { cn } from "@/lib/utils";
import { dersDogrula, dersKisaAdi, RENK_DESENI } from "./kurallar";
import { HataMetni, SadeceGenel, useGenel } from "./ortak";

const VARSAYILAN_RENK = "#0d9488";

export function Dersler() {
  const d = useDb();
  const genel = useGenel();
  const { ad } = useOturum();
  const [yeni, setYeni] = React.useState({ ad: "", kisaAd: "", renk: VARSAYILAN_RENK });
  const kisa = dersKisaAdi(yeni.ad, yeni.kisaAd);
  const hata = dersDogrula({ ad: yeni.ad.trim(), kisaAd: kisa, renk: yeni.renk }, d.dersler);

  const ekle = () => {
    if (hata) return;
    const dersAdi = yeni.ad.trim();
    guncelle((x) => {
      x.dersler.push({ id: yeniId("l"), ad: dersAdi, kisaAd: kisa, renk: yeni.renk, aktif: true });
      islemYaz(x, ad, "Ders", `${dersAdi} eklendi`);
    });
    setYeni({ ad: "", kisaAd: "", renk: VARSAYILAN_RENK });
  };
  const dersGuncelle = (ders: Ders, degisen: Partial<Ders>, kayit?: string) =>
    guncelle((x) => {
      x.dersler = x.dersler.map((z) => (z.id === ders.id ? { ...z, ...degisen } : z));
      if (kayit) islemYaz(x, ad, "Ders", kayit);
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dersler</CardTitle>
        <CardDescription>Kurum geneli. Renk, ders programında hücre rengi olarak kullanılır. Kullanılan ders silinmez, pasife alınır.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {d.dersler.map((x) => (
            <div key={x.id} className="flex items-center gap-3 rounded-md border p-3">
              <span className="grid size-9 place-items-center rounded-md text-[11px] font-semibold text-white" style={{ background: x.renk }}>{x.kisaAd}</span>
              <span className={cn("flex-1 text-sm font-medium", !x.aktif && "text-muted-foreground line-through")}>{x.ad}</span>
              <input
                type="color"
                aria-label={`${x.ad} rengi`}
                disabled={!genel}
                value={x.renk}
                onChange={(e) => RENK_DESENI.test(e.target.value) && dersGuncelle(x, { renk: e.target.value })}
                className="size-7 cursor-pointer rounded border-0 bg-transparent p-0 disabled:cursor-not-allowed"
              />
              <Switch
                label={`${x.ad} aktif`}
                disabled={!genel}
                checked={x.aktif}
                onCheckedChange={(v) => dersGuncelle(x, { aktif: v }, `${x.ad} ${v ? "aktifleştirildi" : "pasife alındı"}`)}
              />
            </div>
          ))}
        </div>
        {genel ? (
          <div className="grid gap-2 rounded-md border border-dashed p-3 sm:grid-cols-[1fr_7rem_3rem_auto] sm:items-end">
            <Field label="Yeni ders"><Input value={yeni.ad} onChange={(e) => setYeni({ ...yeni, ad: e.target.value })} placeholder="Okuma ve anlama" /></Field>
            <Field label="Kısa ad"><Input value={yeni.kisaAd} maxLength={4} placeholder={kisa || "OKU"} onChange={(e) => setYeni({ ...yeni, kisaAd: e.target.value })} /></Field>
            <Field label="Renk"><input type="color" value={yeni.renk} onChange={(e) => setYeni({ ...yeni, renk: e.target.value })} className="h-9 w-12 cursor-pointer rounded border bg-transparent" /></Field>
            <Button onClick={ekle} disabled={!!hata}><Plus /> Ekle</Button>
            <HataMetni hata={yeni.ad ? hata : null} className="text-xs text-danger sm:col-span-4" />
          </div>
        ) : (
          <SadeceGenel />
        )}
      </CardContent>
    </Card>
  );
}
