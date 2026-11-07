import * as React from "react";
import { Check, Trash2 } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, toast } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { guncelle, islemYaz, useDb, type Kurum } from "@/data/store";
import { kurumDogrula, LOGO_EN_FAZLA_BAYT } from "./kurallar";
import { HataMetni, SadeceGenel, useGenel } from "./ortak";

const LOGO_TURLERI = ["image/png", "image/jpeg", "image/svg+xml"];

export function KurumBilgileri() {
  const d = useDb();
  const genel = useGenel();
  const { ad } = useOturum();
  const [f, setF] = React.useState<Kurum>(() => ({
    ...d.kurum,
    ad: d.kurum?.ad ?? "",
    eposta: d.kurum?.eposta ?? "",
    vergiNo: d.kurum?.vergiNo ?? "",
    makbuzBasligi: d.kurum?.makbuzBasligi ?? "",
  }));
  const [logoHata, setLogoHata] = React.useState("");
  const temiz: Kurum = { ...f, ad: f.ad.trim(), eposta: f.eposta.trim(), vergiNo: f.vergiNo.replace(/\s/g, ""), makbuzBasligi: f.makbuzBasligi.trim() };
  const hata = kurumDogrula(temiz);

  const logoSec = (dosya?: File) => {
    setLogoHata("");
    if (!dosya) return;
    if (!LOGO_TURLERI.includes(dosya.type)) return setLogoHata("Logo PNG, JPEG veya SVG olmalı.");
    if (dosya.size > LOGO_EN_FAZLA_BAYT) return setLogoHata("Logo en fazla 200 KB olmalı.");
    const r = new FileReader();
    r.onload = () => setF((x) => ({ ...x, logo: String(r.result) }));
    r.onerror = () => setLogoHata("Logo okunamadı.");
    r.readAsDataURL(dosya);
  };
  const kaydet = (e: React.FormEvent) => {
    e.preventDefault();
    if (hata) return;
    guncelle((x) => {
      x.kurum = temiz;
      islemYaz(x, ad, "Kurum bilgileri", "Kurum bilgileri güncellendi");
    });
    toast("Kurum bilgileri kaydedildi.");
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Kurum bilgileri</CardTitle>
        <CardDescription>Kayıt formu, makbuz ve bildirimlerde kullanılır. Kurum genelinde tek tanımdır.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={kaydet}>
          <Field label="Kurum adı"><Input disabled={!genel} value={f.ad} onChange={(e) => setF({ ...f, ad: e.target.value })} /></Field>
          <Field label="E-posta"><Input disabled={!genel} type="email" value={f.eposta} onChange={(e) => setF({ ...f, eposta: e.target.value })} /></Field>
          <Field label="Vergi no" hint="Yalnızca makbuz/fatura başlığında görünür."><Input disabled={!genel} inputMode="numeric" value={f.vergiNo} onChange={(e) => setF({ ...f, vergiNo: e.target.value })} /></Field>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">Logo (belgelerde)</span>
            <div className="flex items-center gap-3">
              {f.logo ? <img src={f.logo} alt="Kurum logosu" className="size-9 rounded-md border object-contain" /> : <span className="grid size-9 place-items-center rounded-md border text-xs text-muted-foreground">—</span>}
              <Input type="file" disabled={!genel} accept={LOGO_TURLERI.join(",")} className="pt-1.5" onChange={(e) => logoSec(e.target.files?.[0])} />
              {f.logo && genel && <Button type="button" variant="ghost" size="icon" aria-label="Logoyu kaldır" onClick={() => setF({ ...f, logo: undefined })}><Trash2 /></Button>}
            </div>
            <HataMetni hata={logoHata} />
          </div>
          <div className="sm:col-span-2">
            <Field label="Kayıt formu / makbuz başlığı"><Input disabled={!genel} value={f.makbuzBasligi} onChange={(e) => setF({ ...f, makbuzBasligi: e.target.value })} /></Field>
          </div>
          {genel ? (
            <div className="flex items-center justify-end gap-3 sm:col-span-2">
              <HataMetni hata={hata} />
              <Button type="submit" disabled={!!hata}><Check /> Kaydet</Button>
            </div>
          ) : (
            <div className="sm:col-span-2"><SadeceGenel /></div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
