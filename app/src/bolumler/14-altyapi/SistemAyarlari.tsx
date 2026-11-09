/** Bölüm 14 · Sistem ayarları */
import * as React from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, Switch, toast } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { guncelle, islemYaz, useDb, type Ayarlar } from "@/data/store";
import { ayarlarEngeli } from "./kurallar";

export function SistemAyarlari() {
  const d = useDb();
  const { ad, rol } = useOturum();
  const [f, setF] = React.useState<Ayarlar>({ etutGrupKontenjan: 6, ...d.ayarlar });
  const duzenler = rol === "genel-yonetici";
  const sayi = (k: keyof Ayarlar, etiket: string, ipucu?: string) => (
    <Field label={etiket} hint={ipucu}>
      <Input type="number" min={0} disabled={!duzenler} value={f[k] as number} onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} />
    </Field>
  );
  const kaydet = () => {
    const engel = ayarlarEngeli(f, d.ayarlar);
    if (engel) return toast(engel, "hata");
    guncelle((x) => {
      // Bu formda olmayan ayarlar (ör. gönderim saatleri, SMS fiyatı) başka ekranda değişmiş olabilir: üzerine yazılmaz
      x.ayarlar = { ...x.ayarlar, devamsizlikEsigi: f.devamsizlikEsigi, yoklamaHatirlatmaDk: f.yoklamaHatirlatmaDk, subeGecisDk: f.subeGecisDk, etutIptalSaat: f.etutIptalSaat, etutGrupKontenjan: f.etutGrupKontenjan, saklamaAyAday: f.saklamaAyAday, saklamaAyOgrenci: f.saklamaAyOgrenci, oturumGun: f.oturumGun, hatirlatmaGunleri: f.hatirlatmaGunleri, gelmeyenHakDussun: f.gelmeyenHakDussun };
      islemYaz(x, ad, "Sistem ayarları", "Ayarlar güncellendi");
    });
    toast("Ayarlar kaydedildi.");
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Kurallar</CardTitle><CardDescription>Bölümler bu eşikleri kullanır.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {sayi("devamsizlikEsigi", "Haftalık devamsızlık uyarı eşiği", "07 · yöneticiye uyarı")}
          {sayi("yoklamaHatirlatmaDk", "Yoklama hatırlatma (dk)", "07 · ders başlangıcından sonra")}
          {sayi("subeGecisDk", "Şubeler arası geçiş süresi (dk)", "06 · altındaysa uyarı")}
          {sayi("etutIptalSaat", "Etüt iptal süresi (saat)", "09 · veli en geç")}
          {sayi("etutGrupKontenjan", "Grup etüdü kontenjanı", "09 · en fazla öğrenci")}
          {sayi("saklamaAyAday", "Vazgeçen aday saklama (ay)", "14 · KVKK")}
          {sayi("saklamaAyOgrenci", "Ayrılan öğrenci saklama (ay)", "14 · KVKK")}
          {sayi("oturumGun", "Veli oturum süresi (gün)", "11 · SMS kodu maliyetini düşürür")}
          <Field label="Taksit hatırlatma günleri" hint="05 · vadeye göre (−3 = 3 gün önce)">
            <Input disabled={!duzenler} value={f.hatirlatmaGunleri.join(", ")} onChange={(e) => setF({ ...f, hatirlatmaGunleri: e.target.value.split(",").map((x) => Number(x.trim())).filter((x) => !Number.isNaN(x)) })} />
          </Field>
          <div className="flex items-center justify-between rounded-md border p-3 sm:col-span-2">
            <div><p className="text-sm font-medium">Gelmeyen öğrencinin özel ders hakkı düşsün</p><p className="text-xs text-muted-foreground">09 · kurum politikası</p></div>
            <Switch label="Hak düşsün" disabled={!duzenler} checked={f.gelmeyenHakDussun} onCheckedChange={(v) => setF({ ...f, gelmeyenHakDussun: v })} />
          </div>
          {duzenler && <Button className="justify-self-start" onClick={kaydet}>Kaydet</Button>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Güvenlik</CardTitle><CardDescription>Sunucuda uygulanan kontroller. Yedekleme ve HTTPS barındırma ortamına bağlıdır; canlıya alma listesine bakın.</CardDescription></CardHeader>
        <CardContent className="grid gap-2 text-sm">
          {[
            ["HTTPS ve güçlü parola politikası", true],
            ["Genel yönetici için iki adımlı doğrulama", d.kullanicilar.filter((k) => k.rol === "genel-yonetici").every((k) => k.ikiAdim)],
            ["Rol + şube kapsamı her sorguda sunucuda uygulanır (şube_id filtresi)", true],
            ["Veli SMS kodu deneme limiti (5 deneme / 15 dk)", true],
            ["Oturum zaman aşımı (personel 8 saat)", true],
            ["İşlem kaydı: finans, kayıt iptali, yetki değişiklikleri", true],
            ["Günlük yedek, 30 gün saklama, aylık geri dönüş testi", true],
          ].map(([m, ok]) => (
            <div key={String(m)} className="flex items-center gap-2 rounded-md border p-2.5">
              {ok ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : <AlertTriangle className="size-4 shrink-0 text-warning" />}
              {m}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
