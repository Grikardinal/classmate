import * as React from "react";
import { Alert, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, toast } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { guncelle, islemYaz, useDb } from "@/data/store";
import { useSunucuDurumu } from "@/layout/Giris";
import { ayarEngeli } from "./kurallar";

export function Ayarlar() {
  const d = useDb();
  const { ad } = useOturum();
  const [f, setF] = React.useState({ bas: d.ayarlar.gonderimBas, bit: d.ayarlar.gonderimBit, fiyat: String(d.ayarlar.smsBirimFiyat) });
  const fiyat = Number(f.fiyat.replace(",", "."));
  const engel = ayarEngeli({ gonderimBas: f.bas, gonderimBit: f.bit, smsBirimFiyat: fiyat }, d.ayarlar);
  const kaydet = () => {
    if (engel) return;
    guncelle((x) => {
      x.ayarlar = { ...x.ayarlar, gonderimBas: f.bas, gonderimBit: f.bit, smsBirimFiyat: fiyat };
      islemYaz(x, ad, "İletişim ayarları", `Gönderim aralığı ${f.bas}–${f.bit}, SMS ${f.fiyat} ₺`);
    });
    toast("Ayarlar kaydedildi.");
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Gönderim kuralları</CardTitle><CardDescription>Aralık dışında oluşan SMS'ler bir sonraki uygun saate ertelenir.</CardDescription></CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="En erken"><Input type="time" value={f.bas} onChange={(e) => setF({ ...f, bas: e.target.value })} /></Field>
            <Field label="En geç"><Input type="time" value={f.bit} onChange={(e) => setF({ ...f, bit: e.target.value })} /></Field>
          </div>
          <Field label="SMS birim fiyatı (₺)" hint="Maliyet raporları için"><Input inputMode="decimal" value={f.fiyat} onChange={(e) => setF({ ...f, fiyat: e.target.value })} /></Field>
          {engel && <Alert tone="warning">{engel}</Alert>}
          <Button className="justify-self-start" onClick={kaydet} disabled={!!engel}>Kaydet</Button>
        </CardContent>
      </Card>
      <GonderimAltyapisi />
      <Card>
        <CardHeader><CardTitle className="text-base">Yasal notlar</CardTitle></CardHeader>
        <CardContent className="grid gap-2 text-sm text-muted-foreground">
          <p><b className="text-foreground">İYS:</b> tanıtım/kampanya mesajları için izin zorunlu; devamsızlık, ödeme gibi bilgilendirme mesajları muaftır.</p>
          <p><b className="text-foreground">SMS başlığı:</b> gönderici adı (originator) için operatör başvurusu gerekir.</p>
          <p><b className="text-foreground">WhatsApp (v2):</b> Meta işletme doğrulaması, onaylı şablonlar ve mesaj başı ücret gerektirir.</p>
          <p><b className="text-foreground">Giriş kodu:</b> SMS maliyetini düşürmek için veli oturumu {d.ayarlar.oturumGun} gün açık kalır.</p>
        </CardContent>
      </Card>
    </div>
  );
}

/** Sunucudaki gerçek gönderim altyapısı (SMS sağlayıcısı, web push) */
function GonderimAltyapisi() {
  const durum = useSunucuDurumu();
  const d = useDb();
  const bekleyen = d.gonderimler.filter((g) => g.durum === "bekliyor").length;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Gönderim altyapısı</CardTitle><CardDescription>Sunucu ortam değişkenleriyle yapılandırılır (.env).</CardDescription></CardHeader>
      <CardContent className="grid gap-2 text-sm">
        <div className="flex items-center justify-between rounded-md border p-2.5">
          <span>SMS sağlayıcısı</span>
          {durum?.sms === "konsol" ? <Badge variant="warning">Test modu (gönderilmez, konsola yazılır)</Badge> : <Badge variant="success">{durum?.sms ?? "…"}</Badge>}
        </div>
        <div className="flex items-center justify-between rounded-md border p-2.5">
          <span>Uygulama bildirimi (web push)</span>
          <Badge variant={durum?.push ? "success" : "secondary"}>{durum?.push ? "Açık" : "Kapalı"}</Badge>
        </div>
        <div className="flex items-center justify-between rounded-md border p-2.5">
          <span>Kuyrukta bekleyen</span>
          <span className="tabular-nums">{bekleyen}</span>
        </div>
        {durum?.sms === "konsol" && <p className="text-xs text-muted-foreground">Gerçek SMS için sunucuda SMS_SAGLAYICI=netgsm ve Netgsm hesap bilgilerini tanımlayın; gönderim başlığı operatörce onaylı olmalıdır.</p>}
      </CardContent>
    </Card>
  );
}
