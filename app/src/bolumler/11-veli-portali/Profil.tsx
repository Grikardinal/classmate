/** Profil, iletişim izinleri, talep, çıkış */
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Moon, Sun } from "lucide-react";
import { Button, Card, CardContent, Field, Switch, Textarea } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { aktifKayit, grupEtiket, tamAd, useDb, type Veli } from "@/data/store";
import { useBildirimAc, usePortal } from "./ortak";

export function PortalProfil() {
  const d = useDb();
  const { dark, setDark } = useApp();
  const { veli, cocuklar, ogrenciModu, setOgrenciModu, cikis, islem } = usePortal();
  const navigate = useNavigate();
  const [talep, setTalep] = React.useState("");
  const izin = (p: Partial<Pick<Veli, "pushAcik" | "izinSms" | "izinTanitim">>) => void islem("/api/veli/tercih", p);
  const [smsUyari, setSmsUyari] = React.useState(false);
  const bildirimAc = useBildirimAc();
  const talepGonder = async () => {
    if (await islem("/api/veli/talep", { metin: talep.trim() }, "Talebiniz şubeye iletildi.")) setTalep("");
  };
  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-semibold">Profil ve izinler</h1>
      <Card><CardContent className="grid gap-1 p-4 text-sm">
        <p className="font-medium">{tamAd(veli)} · {veli.yakinlik}</p>
        <p className="text-muted-foreground">{veli.telefon}</p>
        <p className="text-muted-foreground">Çocuklar: {cocuklar.map((o) => `${o.ad} (${grupEtiket(d, aktifKayit(d, o.id)!.grupId)})`).join(", ")}</p>
      </CardContent></Card>
      <Card><CardContent className="grid gap-3 p-4 text-sm">
        <div className="flex items-center justify-between"><span>Uygulama bildirimleri</span><Switch label="Bildirimler" checked={veli.pushAcik} onCheckedChange={(v) => (v ? void bildirimAc() : izin({ pushAcik: false }))} /></div>
        <div className="flex items-center justify-between"><span>Bilgilendirme SMS'i</span><Switch label="SMS" checked={veli.izinSms} onCheckedChange={(v) => (v ? izin({ izinSms: true }) : setSmsUyari(true))} /></div>
        {smsUyari && (
          <div role="alert" className="grid gap-2 rounded-md border border-warning/50 bg-warning/10 p-3">
            <p>SMS iznini kapatırsanız devamsızlık gibi önemli bilgiler yalnızca uygulama bildirimiyle gelir.</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { izin({ izinSms: false }); setSmsUyari(false); }}>SMS iznini kapat</Button>
              <Button size="sm" variant="ghost" onClick={() => setSmsUyari(false)}>Vazgeç</Button>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between"><span>Kampanya / tanıtım mesajları</span><Switch label="Tanıtım" checked={veli.izinTanitim} onCheckedChange={(v) => izin({ izinTanitim: v })} /></div>
        <div className="flex items-center justify-between"><span className="flex items-center gap-2">{dark ? <Moon className="size-4" /> : <Sun className="size-4" />} Koyu tema</span><Switch label="Koyu tema" checked={dark} onCheckedChange={setDark} /></div>
        <div className="flex items-center justify-between"><span>Öğrenci görünümü <span className="block text-xs text-muted-foreground">Ödemeler gizlenir; çocuğunuza gösterirken</span></span><Switch label="Öğrenci görünümü" checked={ogrenciModu} onCheckedChange={setOgrenciModu} /></div>
      </CardContent></Card>
      <Card><CardContent className="grid gap-2 p-4">
        <Field label="İletişim bilgisi güncelleme talebi"><Textarea value={talep} onChange={(e) => setTalep(e.target.value)} placeholder="Yeni telefon numaram: …" /></Field>
        <Button variant="outline" onClick={talepGonder} disabled={!talep.trim()}>Gönder</Button>
      </CardContent></Card>
      <Button variant="ghost" className="text-danger" onClick={() => { cikis(); navigate("/veli"); }}><LogOut /> Çıkış yap</Button>
      <p className="text-center text-xs text-muted-foreground">Kişisel verileriniz KVKK kapsamında işlenir. Bilgi talebi veya silme başvurusu için şubenize başvurabilirsiniz.</p>
    </div>
  );
}
