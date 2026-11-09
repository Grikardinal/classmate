import * as React from "react";
import { Info, MessageSquare, Pencil, Send, Smartphone } from "lucide-react";
import { Alert, Badge, Button, Card, Dialog, Field, Select, StatCard, Switch, Table, Td, Textarea, Th, toast } from "@/components/ui";
import { useApp, useOturum } from "@/context/AppContext";
import { BUGUN, guncelle, islemYaz, useDb, type BildirimOlayi } from "@/data/store";
import { sablonDoldur, smsBoyu, tl, type VarsayilanKanal } from "@/lib/kurallar";
import { izinliDegiskenler, sablonEngeli } from "./kurallar";
import { kanalAd, ornekDegiskenler } from "./ortak";

export function BildirimMerkezi() {
  const d = useDb();
  const { moduller } = useApp();
  const { rol, ad } = useOturum();
  const [duzenle, setDuzenle] = React.useState<BildirimOlayi | null>(null);
  const yonetici = rol === "genel-yonetici";
  const olaylar = d.olaylar.filter((o) => (!o.finans || moduller.finans) && (!o.modul || moduller[o.modul]));
  const guncelleOlay = (key: string, p: Partial<BildirimOlayi>) =>
    guncelle((x) => {
      x.olaylar = x.olaylar.map((o) => (o.key === key ? { ...o, ...p } : o));
      islemYaz(x, ad, "Bildirim ayarı", `${x.olaylar.find((o) => o.key === key)?.ad}: ${JSON.stringify(p)}`);
    });
  const buAy = d.gonderimler.filter((g) => g.zaman.startsWith(BUGUN.slice(0, 7)));

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Bu ay gönderim" value={buAy.length} icon={<Send />} />
        <StatCard label="Uygulama bildirimi" value={buAy.filter((g) => g.kanal === "push").length} icon={<Smartphone />} tone="success" hint="Ücretsiz" />
        <StatCard label="SMS" value={buAy.filter((g) => g.kanal === "sms").length} icon={<MessageSquare />} hint={tl(buAy.reduce((s, g) => s + g.maliyet, 0))} />
        <StatCard label="Bildirimi açık veli" value={`%${Math.round((d.veliler.filter((v) => v.pushAcik).length / Math.max(1, d.veliler.length)) * 100)}`} hint="Arttıkça SMS maliyeti düşer" />
      </div>
      <Alert icon={<Info />}>
        <b>Uygulama + SMS:</b> önce uygulama bildirimi gönderilir; veli bildirimleri açmamışsa SMS gider. iPhone'da web bildirimi yalnızca portal ana ekrana eklenince çalışır,
        bu yüzden kritik mesajlarda SMS yedeği kullanılır. SMS iznini kapatan veliye SMS gitmez. Bilgilendirme mesajları İYS izni gerektirmez; tanıtım mesajı gönderilmez.
      </Alert>
      <Card>
        <Table>
          <thead><tr><Th>Olay</Th><Th>Kanal</Th><Th>Şablon</Th><Th className="text-center">Açık</Th><Th /></tr></thead>
          <tbody>
            {olaylar.map((o) => (
              <tr key={o.key}>
                <Td className="font-medium">
                  {o.ad}
                  {o.finans && <Badge variant="outline" className="ml-2">Finans</Badge>}
                </Td>
                <Td>
                  <Select aria-label={`${o.ad} kanalı`} className="h-8 w-52 text-xs" value={o.kanal} disabled={!yonetici} onChange={(e) => guncelleOlay(o.key, { kanal: e.target.value as VarsayilanKanal })}>
                    {Object.entries(kanalAd).map(([k, a]) => <option key={k} value={k}>{a}</option>)}
                  </Select>
                </Td>
                <Td className="max-w-sm"><p className="line-clamp-2 text-xs text-muted-foreground">{o.sablon}</p></Td>
                <Td className="text-center"><div className="flex justify-center"><Switch label={`${o.ad} açık`} checked={o.aktif} disabled={!yonetici} onCheckedChange={(v) => guncelleOlay(o.key, { aktif: v })} /></div></Td>
                {/* Duyuru metnini duyuruyu yazan belirler; bu satırın şablonu kullanılmaz */}
                <Td className="text-right">{yonetici && o.key !== "duyuru" && <Button variant="ghost" size="sm" onClick={() => setDuzenle(o)}><Pencil /> Metin</Button>}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      {duzenle && <SablonDialog olay={duzenle} onClose={() => setDuzenle(null)} />}
    </div>
  );
}

function SablonDialog({ olay, onClose }: { olay: BildirimOlayi; onClose: () => void }) {
  const { ad } = useOturum();
  const [metin, setMetin] = React.useState(olay.sablon);
  const onizleme = sablonDoldur(metin, ornekDegiskenler);
  const engel = sablonEngeli(olay.key, metin);
  const kaydet = () => {
    if (engel) return;
    guncelle((x) => {
      x.olaylar = x.olaylar.map((o) => (o.key === olay.key ? { ...o, sablon: metin } : o));
      islemYaz(x, ad, "Bildirim şablonu", `${olay.ad} metni güncellendi`);
    });
    toast("Şablon kaydedildi.");
    onClose();
  };
  return (
    <Dialog open onClose={onClose} wide title={`Şablon: ${olay.ad}`} footer={<><Button variant="outline" onClick={onClose}>Vazgeç</Button><Button onClick={kaydet} disabled={!!engel}>Kaydet</Button></>}>
      <Field label="Metin"><Textarea value={metin} onChange={(e) => setMetin(e.target.value)} /></Field>
      <div className="flex flex-wrap gap-1.5">
        {izinliDegiskenler(olay.key).map((v) => (
          <button key={v} onClick={() => setMetin(metin + ` {${v}}`)} className="rounded-full border px-2 py-0.5 font-mono text-xs text-muted-foreground hover:border-primary hover:text-primary">{`{${v}}`}</button>
        ))}
      </div>
      {engel && <Alert tone="warning">{engel}</Alert>}
      <div className="rounded-lg bg-muted p-3 text-sm">
        <p className="mb-1 text-xs text-muted-foreground">Önizleme</p>
        {onizleme}
        <p className="mt-2 text-xs text-muted-foreground">{onizleme.length} karakter · {smsBoyu(onizleme)} SMS</p>
      </div>
    </Dialog>
  );
}
