import * as React from "react";
import { Check } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Table, Td, Th, toast } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { guncelle, islemYaz, useDb } from "@/data/store";
import { tl } from "@/lib/kurallar";
import { fiyatGecerli, fiyatListesiDogrula } from "./kurallar";
import { HataMetni, useGenel } from "./ortak";

/** Fiyat listesi (yalnızca Finans modülü açıkken görünür) */
export function FiyatListesi() {
  const d = useDb();
  const genel = useGenel();
  const { ad } = useOturum();
  // Ekranda yazılan metin tutulur; boş kutu 0 sayılmaz, kaydetmeden önce doğrulanır
  const [f, setF] = React.useState<Record<string, string>>(() => Object.fromEntries(d.subeler.map((s) => [s.id, String(d.fiyatListesi[s.id] ?? 0)])));
  const sayilar = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() === "" ? NaN : Number(v)]));
  const hata = fiyatListesiDogrula(sayilar);

  const kaydet = () => {
    if (hata) return;
    guncelle((x) => {
      x.fiyatListesi = { ...x.fiyatListesi, ...sayilar };
      islemYaz(x, ad, "Fiyat listesi", "Liste fiyatları güncellendi");
    });
    toast("Fiyat listesi kaydedildi.");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fiyat listesi</CardTitle>
        <CardDescription>Sezonluk liste fiyatı; şube bazında farklılaşabilir. Kayıt sihirbazı bu fiyattan başlar, indirimler ayrıca uygulanır.</CardDescription>
      </CardHeader>
      <Table>
        <thead><tr><Th>Şube</Th><Th className="w-48">Liste fiyatı (₺)</Th><Th className="text-right">Görünüm</Th></tr></thead>
        <tbody>
          {d.subeler.map((s) => (
            <tr key={s.id}>
              <Td className="font-medium">{s.ad}</Td>
              <Td><Input type="number" min={0} step="0.01" aria-label={`${s.ad} liste fiyatı`} disabled={!genel} value={f[s.id] ?? "0"} onChange={(e) => setF({ ...f, [s.id]: e.target.value })} /></Td>
              <Td className="text-right tabular-nums">{fiyatGecerli(sayilar[s.id]) ? tl(sayilar[s.id]) : "—"}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {genel && (
        <CardContent className="flex items-center justify-end gap-3 pt-4">
          <HataMetni hata={hata} />
          <Button onClick={kaydet} disabled={!!hata}><Check /> Kaydet</Button>
        </CardContent>
      )}
    </Card>
  );
}
