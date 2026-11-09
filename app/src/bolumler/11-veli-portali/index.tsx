/**
 * Bölüm 11 · Veli ve öğrenci portalı (PWA)
 * Doküman: docs/bolumler/11-veli-ve-ogrenci-portali.md
 *
 * /veli-portali → yönetim tarafı: portal önizlemesi ve kullanım durumu
 * /veli/*       → velinin telefonunda açtığı portal (ayrı, mobil öncelikli düzen)
 */
import * as React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { BellRing, ChevronRight, ExternalLink, Smartphone, Users, WifiOff } from "lucide-react";
import { Alert, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, PageHeader, StatCard, toast } from "@/components/ui";
import { useApp, useOturum } from "@/context/AppContext";
import { aktifKayit, useDb, useVeriHazir, veriYukle, veriyiTemizle } from "@/data/store";
import { api, ApiHatasi } from "@/lib/api";
import { Yukleniyor, useSunucuDurumu } from "@/layout/Giris";
import { PortalAnaSayfa } from "./AnaSayfa";
import { PortalEtut } from "./Etut";
import { PortalGiris } from "./Giris";
import { PortalKabuk } from "./Kabuk";
import { PortalContext } from "./ortak";
import { PortalProfil } from "./Profil";
import { cihazAboneliginiBirak, cihazUcu } from "./push";
import { PortalBildirimler, PortalDuyurular, PortalOdemeler, PortalOdevler, PortalOgretmenler, PortalProgram, PortalYoklama } from "./Sayfalar";

/* =========================== Yönetim tarafı =========================== */
export default function VeliPortali() {
  const d = useDb();
  const { subeGorunur } = useOturum();
  const sunucu = useSunucuDurumu();
  const veliler = d.veliler.filter((v) => d.ogrenciler.some((o) => o.veliIds.includes(v.id) && subeGorunur(aktifKayit(d, o.id)?.subeId)));
  const giris = veliler.filter((v) => v.portalDavet === "giris-yapti").length;
  const push = veliler.filter((v) => v.pushAcik).length;
  return (
    <div className="grid gap-6">
      <PageHeader
        code="11"
        title="Veli portalı"
        description="Veli, uygulama indirmeden telefonundan her şeyi görür. Ana ekrana eklenebilir (PWA); giriş telefon + SMS koduyla."
        actions={
          <Button onClick={() => window.open("/veli", "_blank")}>
            <ExternalLink /> Portalı yeni sekmede aç
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="grid content-start gap-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Portala giriş yapan veli" value={`${giris}/${veliler.length}`} hint={`%${Math.round((giris / Math.max(1, veliler.length)) * 100)}`} icon={<Users />} />
            <StatCard label="Bildirimi açık" value={`${push}/${veliler.length}`} hint="Kapalı olanlara kritik mesajlar SMS ile gider" icon={<BellRing />} tone="success" />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Velinin gördükleri</CardTitle>
              <CardDescription>Modüllere göre otomatik şekillenir; kapalı modüller portalda da görünmez.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {[
                ["Ana sayfa", "Çocuk seçici, bugünün dersleri, son yoklama, bekleyen ödevler, duyurular, şube bilgisi"],
                ["Ders programı", "Haftalık program, tatil ve iptaller"],
                ["Yoklama ve konular", "Devam geçmişi, işlenen konular, “yarın gelemeyecek” izin bildirimi"],
                ["Ödevler", "Aktif ve geçmiş ödevler, teslim durumu, öğretmen notu (Ödev modülü)"],
                ["Etüt randevusu", "Boş slottan randevu alma, iptal (Etüt modülü)"],
                ["Ödemeler", "Taksitler ve makbuzlar (yalnızca Finans modülü açıksa)"],
                ["Bildirimler ve profil", "Gelen mesajlar, iletişim izinleri, bilgi güncelleme talebi"],
              ].map(([b, a]) => (
                <div key={b} className="flex gap-3 rounded-md border p-3">
                  <ChevronRight className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div><p className="font-medium">{b}</p><p className="text-muted-foreground">{a}</p></div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Alert icon={<Smartphone />}>
            Kurspro'daki “Haftanın Yıldızları”, sınav sonuçları ve sözlü notlar bilinçli olarak alınmadı (sınav analizi kapsam dışı).
          </Alert>
        </div>
        <div className="mx-auto w-full max-w-[380px]">
          <div className="rounded-[2.5rem] border-8 border-foreground/90 bg-foreground/90 shadow-2xl">
            <iframe title="Veli portalı önizleme" src="/veli" className="h-[720px] w-full rounded-[2rem] bg-background" />
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">{sunucu?.demo ? "Canlı önizleme · demo velisiyle giriş yapabilirsiniz" : "Canlı önizleme · veli giriş ekranı"}</p>
        </div>
      </div>
    </div>
  );
}

/* =========================== Portal (veli tarafı) =========================== */
const oturumYok = (e: unknown) => e instanceof ApiHatasi && e.durum === 401;

export function VeliPortaliUygulamasi() {
  const { dark } = useApp();
  const [durum, setDurum] = React.useState<"bekliyor" | "giris" | "hata" | "hazir">("bekliyor");
  const [hataMetni, setHataMetni] = React.useState("");
  const hazir = useVeriHazir();
  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  const yukle = React.useCallback(async () => {
    try {
      await veriYukle("veli");
      setDurum("hazir");
    } catch (e) {
      // Bağlantı/sunucu hatası oturumun bittiği anlamına gelmez: giriş ekranına düşürülmez
      if (oturumYok(e)) return setDurum("giris");
      setHataMetni(e instanceof Error ? e.message : "Veriler yüklenemedi.");
      setDurum("hata");
    }
  }, []);
  React.useEffect(() => {
    void yukle();
  }, [yukle]);
  const oturumBitti = React.useCallback(() => {
    setDurum("giris");
    veriyiTemizle();
  }, []);
  // Arka plan yenilemesi hataları yutar; oturum düşünce (pasif veli, süre) kişisel veri ekranda kalmasın
  React.useEffect(() => {
    if (durum !== "hazir") return;
    const denetle = () => {
      if (document.visibilityState === "visible") api("/api/veli/ben").catch((e) => oturumYok(e) && oturumBitti());
    };
    window.addEventListener("focus", denetle);
    const zaman = setInterval(denetle, 60_000);
    return () => {
      window.removeEventListener("focus", denetle);
      clearInterval(zaman);
    };
  }, [durum, oturumBitti]);

  if (durum === "bekliyor" || (durum === "hazir" && !hazir)) return <Yukleniyor />;
  if (durum === "giris") return <PortalGiris onGiris={() => { setDurum("bekliyor"); void yukle(); }} />;
  if (durum === "hata")
    return (
      <div role="alert" className="mx-auto grid min-h-dvh max-w-md place-content-center justify-items-center gap-3 p-6 text-center">
        <WifiOff className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{hataMetni}</p>
        <Button onClick={() => { setDurum("bekliyor"); void yukle(); }}>Tekrar dene</Button>
      </div>
    );
  return <PortalIcerik onCikis={oturumBitti} />;
}

function PortalIcerik({ onCikis }: { onCikis: () => void }) {
  const d = useDb();
  const [cocukId, setCocukId] = React.useState<string | null>(null);
  const [ogrenciModu, setOgrenciModu] = React.useState(false);
  const veli = d.veliler[0];
  const cocuklar = d.ogrenciler.filter((o) => o.veliIds.includes(veli.id) && aktifKayit(d, o.id));
  if (!cocuklar.length) return <div className="grid min-h-dvh place-items-center p-6 text-center text-sm text-muted-foreground">Hesabınıza bağlı aktif öğrenci bulunamadı. Şubenizle iletişime geçin.</div>;
  const cocuk = cocuklar.find((o) => o.id === cocukId) ?? cocuklar[0];
  const cikis = async () => {
    try {
      await api("/api/veli/cikis", { endpoint: await cihazUcu() });
    } catch (e) {
      // Çerez sunucuda kapanmadıysa "çıktı" gibi gösterilmez (ortak cihaz)
      if (!oturumYok(e)) return toast("Çıkış yapılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.", "hata");
    }
    await cihazAboneliginiBirak();
    onCikis();
  };
  const islem = async (yol: string, govde: unknown = {}, basari?: string) => {
    try {
      await api(yol, govde);
    } catch (e) {
      toast(e instanceof Error ? e.message : "İşlem yapılamadı.", "hata");
      if (oturumYok(e)) onCikis();
      return false;
    }
    // İşlem sunucuda tamamlandı; yenileme hatası işlemi başarısız göstermez
    await veriYukle("veli").catch((e) => oturumYok(e) && onCikis());
    if (basari) toast(basari);
    return true;
  };

  return (
    <PortalContext.Provider value={{ veli, cocuklar, cocuk, setCocukId, ogrenciModu, setOgrenciModu, cikis: () => void cikis(), islem }}>
      <PortalKabuk>
        <Routes>
          <Route index element={<PortalAnaSayfa />} />
          <Route path="program" element={<PortalProgram />} />
          <Route path="yoklama" element={<PortalYoklama />} />
          <Route path="odevler" element={<PortalOdevler />} />
          <Route path="duyurular" element={<PortalDuyurular />} />
          <Route path="etut" element={<PortalEtut />} />
          <Route path="odemeler" element={<PortalOdemeler />} />
          <Route path="ogretmenler" element={<PortalOgretmenler />} />
          <Route path="bildirimler" element={<PortalBildirimler />} />
          <Route path="profil" element={<PortalProfil />} />
          <Route path="*" element={<Navigate to="/veli" replace />} />
        </Routes>
      </PortalKabuk>
    </PortalContext.Provider>
  );
}
