/**
 * Bölüm 11 · Veli ve öğrenci portalı (PWA)
 * Doküman: docs/bolumler/11-veli-ve-ogrenci-portali.md
 *
 * /veli-portali → yönetim tarafı: portal önizlemesi ve kullanım durumu
 * /veli/*       → velinin telefonunda açtığı portal (ayrı, mobil öncelikli düzen)
 */
import * as React from "react";
import { Link, NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import {
  Bell,
  BellRing,
  BookOpenCheck,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  Clock,
  ExternalLink,
  Home,
  LogOut,
  MapPin,
  Megaphone,
  Menu,
  Moon,
  Phone,
  Smartphone,
  Sun,
  UserRound,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/Logo";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  Field,
  Input,
  PageHeader,
  StatCard,
  Switch,
  Textarea,
  Toaster,
  toast,
} from "@/components/ui";
import { useApp, useOturum } from "@/context/AppContext";
import { gunAdlari, gunKisa } from "@/data/mock";
import {
  BUGUN,
  aktifKayit,
  ders,
  dersAdi,
  derslikAdi,
  grup,
  grupEtiket,
  oturumlar,
  ogrenciYoklamalari,
  personelAdi,
  simdiZaman,
  sube,
  taksitAdi,
  taksitKalan,
  tamAd,
  useDb,
  useVeriHazir,
  veriYukle,
  veriyiTemizle,
  type Ogrenci,
  type Veli,
} from "@/data/store";
import { gunFarki, haftaGunu, iyelik, tarihEkle, telefonNormalize, tl } from "@/lib/kurallar";
import { bosSlotlar, etutTurAd } from "./09-etut";
import { api, ApiHatasi } from "@/lib/api";
import { Yukleniyor, useSunucuDurumu } from "@/layout/Giris";
import { cn } from "@/lib/utils";

/* =========================== Yönetim tarafı =========================== */
export default function VeliPortali() {
  const d = useDb();
  const { subeGorunur } = useOturum();
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
          <p className="mt-2 text-center text-xs text-muted-foreground">Canlı önizleme · demo velisiyle giriş yapabilirsiniz</p>
        </div>
      </div>
    </div>
  );
}

/* =========================== Web push =========================== */
function anahtarCoz(b64: string) {
  const dolgu = "=".repeat((4 - (b64.length % 4)) % 4);
  const ham = atob((b64 + dolgu).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...ham].map((c) => c.charCodeAt(0)));
}
/** Cihazı web push'a abone eder ve aboneliği sunucuya kaydeder */
async function pushAboneOl(): Promise<"tamam" | "izin-yok" | "desteklenmiyor"> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "desteklenmiyor";
  try {
    if ((await Notification.requestPermission()) !== "granted") return "izin-yok";
    const kayit = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const { anahtar } = await api<{ anahtar: string }>("/api/push/anahtar");
    const abonelik = (await kayit.pushManager.getSubscription()) ?? (await kayit.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: anahtarCoz(anahtar) }));
    await api("/api/veli/push/abone", { abonelik: abonelik.toJSON() });
    return "tamam";
  } catch {
    return "desteklenmiyor";
  }
}

/* =========================== Portal (veli tarafı) =========================== */
type PortalCtx = {
  veli: Veli;
  cocuklar: Ogrenci[];
  cocuk: Ogrenci;
  setCocukId: (id: string) => void;
  ogrenciModu: boolean;
  setOgrenciModu: (v: boolean) => void;
  cikis: () => void;
  /** Veli işlemi: sunucu ucunu çağırır, ardından güncel veriyi yükler */
  islem: (yol: string, govde?: unknown, basari?: string) => Promise<boolean>;
};
const PortalContext = React.createContext<PortalCtx | null>(null);
const usePortal = () => React.useContext(PortalContext)!;

export function VeliPortaliUygulamasi() {
  const { dark } = useApp();
  const [durum, setDurum] = React.useState<"bekliyor" | "giris" | "hazir">("bekliyor");
  const hazir = useVeriHazir();
  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  const yukle = React.useCallback(async () => {
    try {
      await veriYukle("veli");
      setDurum("hazir");
    } catch (e) {
      if (e instanceof ApiHatasi && e.durum === 401) setDurum("giris");
      else setDurum("giris");
    }
  }, []);
  React.useEffect(() => {
    void yukle();
  }, [yukle]);

  if (durum === "bekliyor" || (durum === "hazir" && !hazir)) return <Yukleniyor />;
  if (durum === "giris") return <PortalGiris onGiris={() => { setDurum("bekliyor"); void yukle(); }} />;
  return <PortalIcerik onCikis={() => { veriyiTemizle(); setDurum("giris"); }} />;
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
    await api("/api/veli/cikis", {}).catch(() => undefined);
    onCikis();
  };
  const islem = async (yol: string, govde: unknown = {}, basari?: string) => {
    try {
      await api(yol, govde);
      await veriYukle("veli");
      if (basari) toast(basari);
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : "İşlem yapılamadı.", "hata");
      if (e instanceof ApiHatasi && e.durum === 401) onCikis();
      return false;
    }
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

function PortalGiris({ onGiris }: { onGiris: () => void }) {
  const durum = useSunucuDurumu();
  const [tel, setTel] = React.useState("");
  const [adim, setAdim] = React.useState<"tel" | "kod">("tel");
  const [kod, setKod] = React.useState("");
  const [demoKod, setDemoKod] = React.useState<string | undefined>();
  const [hata, setHata] = React.useState("");
  const [bekliyor, setBekliyor] = React.useState(false);
  const norm = telefonNormalize(tel);

  const kodGonder = async () => {
    setHata("");
    if (!norm) return setHata("Geçerli bir cep telefonu girin.");
    setBekliyor(true);
    try {
      const r = await api<{ demoKod?: string }>("/api/veli/kod", { telefon: norm });
      setDemoKod(r.demoKod);
      setAdim("kod");
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Kod gönderilemedi.");
    } finally {
      setBekliyor(false);
    }
  };
  const dogrula = async () => {
    setHata("");
    setBekliyor(true);
    try {
      await api("/api/veli/giris", { telefon: norm, kod });
      onGiris();
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Giriş yapılamadı.");
    } finally {
      setBekliyor(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-6 py-10">
      <div className="text-center">
        <LogoMark className="mx-auto size-14" />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Veli girişi</h1>
        <p className="mt-1 text-sm text-muted-foreground">{durum?.kurum} · Parola yok — telefonunuza gelen kodla girersiniz.</p>
      </div>
      {adim === "tel" ? (
        <div className="grid gap-3">
          <Field label="Cep telefonunuz"><Input inputMode="tel" autoComplete="tel" autoFocus className="h-12 text-base" placeholder="05xx xxx xx xx" value={tel} onChange={(e) => setTel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void kodGonder()} /></Field>
          {hata && <p className="text-sm text-danger" role="alert">{hata}</p>}
          <Button className="h-12 text-base" onClick={() => void kodGonder()} disabled={bekliyor}>Kod gönder</Button>
          {durum?.demo && !!durum.demoVeliler?.length && (
            <div className="mt-4 rounded-lg border border-dashed p-3">
              <p className="mb-2 text-xs text-muted-foreground">Demo: örnek bir veliyle deneyin</p>
              <div className="grid gap-1.5">
                {durum.demoVeliler.map((v) => (
                  <button key={v.telefon} onClick={() => setTel(v.telefon)} className="flex items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted">
                    <span>{v.ad} <span className="text-xs text-muted-foreground">· {v.cocuklar}</span></span>
                    <span className="font-mono text-xs text-muted-foreground">{v.telefon}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          <p className="text-sm">Numara kayıtlıysa {norm} numarasına 6 haneli kod gönderdik (5 dakika geçerli).</p>
          <Input inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6} className="h-12 text-center font-mono text-xl tracking-[0.5em]" value={kod} onChange={(e) => setKod(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => e.key === "Enter" && kod.length === 6 && void dogrula()} />
          {demoKod && <p className="text-xs text-muted-foreground">Demo (SMS konsola yazıldı): <b className="font-mono">{demoKod}</b></p>}
          {hata && <p className="text-sm text-danger" role="alert">{hata}</p>}
          <Button className="h-12 text-base" onClick={() => void dogrula()} disabled={kod.length !== 6 || bekliyor}>Giriş yap</Button>
          <Button variant="ghost" onClick={() => { setAdim("tel"); setKod(""); setHata(""); }}>Numarayı değiştir</Button>
          <p className="text-center text-xs text-muted-foreground">Bu cihazda {durum ? "uzun süre" : ""} oturum açık kalır; ortak cihazda çıkış yapmayı unutmayın.</p>
        </div>
      )}
    </div>
  );
}

function PortalKabuk({ children }: { children: React.ReactNode }) {
  const d = useDb();
  const { moduller } = useApp();
  const { veli, cocuklar, cocuk, setCocukId, ogrenciModu } = usePortal();
  const [menu, setMenu] = React.useState(false);
  const okunmamis = d.duyurular.filter((du) => !du.zamanlanmis && du.aliciVeliIds.includes(veli.id) && !du.okuyanVeliIds.includes(veli.id)).length;
  const alt = [
    { to: "/veli", ad: "Ana Sayfa", ikon: Home, end: true },
    { to: "/veli/program", ad: "Program", ikon: CalendarDays },
    moduller.finans && !ogrenciModu ? { to: "/veli/odemeler", ad: "Ödemeler", ikon: Wallet } : { to: "/veli/yoklama", ad: "Yoklama", ikon: ClipboardCheck },
    ...(moduller.odev ? [{ to: "/veli/odevler", ad: "Ödevler", ikon: BookOpenCheck }] : []),
    { to: "/veli/duyurular", ad: "Duyurular", ikon: Megaphone, rozet: okunmamis },
  ];
  const diger = [
    { to: "/veli/yoklama", ad: "Yoklama ve konular", ikon: ClipboardCheck },
    ...(moduller.etut ? [{ to: "/veli/etut", ad: "Etüt randevuları", ikon: Clock }] : []),
    ...(moduller.finans && !ogrenciModu ? [{ to: "/veli/odemeler", ad: "Ödemeler", ikon: Wallet }] : []),
    { to: "/veli/ogretmenler", ad: "Öğretmenler", ikon: Users },
    { to: "/veli/bildirimler", ad: "Bildirimler", ikon: Bell },
    { to: "/veli/profil", ad: "Profil ve izinler", ikon: UserRound },
  ];
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/90 px-4 pb-3 pt-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <Link to="/veli"><Logo /></Link>
          <div className="flex items-center gap-1">
            <Link to="/veli/bildirimler" className="grid size-10 place-items-center rounded-full hover:bg-muted" aria-label="Bildirimler"><Bell className="size-5" /></Link>
            <button onClick={() => setMenu(true)} className="grid size-10 place-items-center rounded-full hover:bg-muted" aria-label="Menü"><Menu className="size-5" /></button>
          </div>
        </div>
        {cocuklar.length > 1 && (
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
            {cocuklar.map((o) => (
              <button key={o.id} onClick={() => setCocukId(o.id)} className={cn("flex shrink-0 items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm transition", o.id === cocuk.id ? "border-primary bg-accent font-medium text-accent-foreground" : "text-muted-foreground")}>
                <Avatar ad={tamAd(o)} className="size-7 text-[10px]" />
                {o.ad} <span className="text-xs opacity-70">{grupEtiket(d, aktifKayit(d, o.id)!.grupId)}</span>
              </button>
            ))}
          </div>
        )}
      </header>
      <main className="flex-1 px-4 pb-24 pt-4">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto grid max-w-md border-t bg-background/95 backdrop-blur" style={{ gridTemplateColumns: `repeat(${alt.length}, 1fr)` }}>
        {alt.map((a) => (
          <NavLink key={a.to} to={a.to} end={"end" in a && a.end} className={({ isActive }) => cn("relative flex flex-col items-center gap-0.5 py-2.5 text-[11px]", isActive ? "text-primary" : "text-muted-foreground")}>
            <a.ikon className="size-5" />
            {a.ad}
            {"rozet" in a && !!a.rozet && <span className="absolute right-[22%] top-1.5 grid size-4 place-items-center rounded-full bg-danger text-[9px] font-semibold text-white">{a.rozet}</span>}
          </NavLink>
        ))}
      </nav>
      {menu && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenu(false)} />
          <div className="absolute inset-y-0 right-0 w-72 border-l bg-card p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div><p className="font-medium">{tamAd(veli)}</p><p className="text-xs text-muted-foreground">{veli.telefon}</p></div>
              <button onClick={() => setMenu(false)} className="grid size-9 place-items-center rounded-full hover:bg-muted" aria-label="Kapat"><X className="size-5" /></button>
            </div>
            <div className="grid gap-1">
              {diger.map((a) => (
                <Link key={a.to} to={a.to} onClick={() => setMenu(false)} className="flex items-center gap-3 rounded-md px-3 py-3 text-sm hover:bg-muted">
                  <a.ikon className="size-5 text-muted-foreground" /> {a.ad}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
      <Toaster />
    </div>
  );
}

function Bolum({ baslik, children, link }: { baslik: string; children: React.ReactNode; link?: { to: string; ad: string } }) {
  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{baslik}</h2>
        {link && <Link to={link.to} className="text-xs text-primary">{link.ad}</Link>}
      </div>
      {children}
    </section>
  );
}

const yoklamaRenk = { geldi: "success", gelmedi: "danger", gec: "warning", izinli: "secondary" } as const;
const yoklamaAd = { geldi: "Geldi", gelmedi: "Gelmedi", gec: "Geç geldi", izinli: "İzinli" } as const;
const tarihKisa = (iso: string) => new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short", weekday: "short" });

function PortalAnaSayfa() {
  const d = useDb();
  const { moduller } = useApp();
  const { veli, cocuk, ogrenciModu, islem } = usePortal();
  const k = aktifKayit(d, cocuk.id)!;
  const s = sube(k.subeId)!;
  const bugun = oturumlar(d, BUGUN).filter((o) => o.satir.grupId === k.grupId);
  const sonYoklama = ogrenciYoklamalari(d, cocuk.id)[0];
  const odevler = d.odevler.filter((o) => o.grupId === k.grupId && o.teslim >= BUGUN && (!o.ogrenciIds || o.ogrenciIds.includes(cocuk.id)));
  const duyurular = d.duyurular.filter((du) => !du.zamanlanmis && du.aliciVeliIds.includes(veli.id)).sort((a, b) => b.zaman.localeCompare(a.zaman)).slice(0, 2);
  const taksitler = d.taksitler.filter((t) => t.ogrenciId === cocuk.id && taksitKalan(t) > 0).sort((a, b) => a.vade.localeCompare(b.vade));
  const [izinAcik, setIzinAcik] = React.useState(false);

  const bildirimAc = async () => {
    const r = await pushAboneOl();
    if (r === "tamam") {
      await islem("/api/veli/tercih", { pushAcik: true }, "Bildirimler açıldı. Önemli mesajlar artık bu cihaza gelecek.");
    } else if (r === "izin-yok") toast("Bildirim izni verilmedi. Tarayıcı ayarlarından izin verebilirsiniz.", "uyari");
    else toast("Bu tarayıcı bildirimleri desteklemiyor. iPhone'da önce Paylaş → “Ana Ekrana Ekle” deyin, uygulamayı oradan açın.", "uyari");
  };

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-sm text-muted-foreground">Merhaba {veli.ad} 👋</p>
        <h1 className="text-xl font-semibold">{iyelik(cocuk.ad)} günü</h1>
      </div>

      {!veli.pushAcik && !ogrenciModu && (
        <div className="rounded-xl bg-primary p-4 text-primary-foreground">
          <p className="font-semibold">Bildirimleri açın</p>
          <p className="mt-1 text-sm opacity-90">Devamsızlık ve ders iptallerinden anında haberdar olun. iPhone'da önce “Ana Ekrana Ekle” deyin.</p>
          <Button variant="secondary" className="mt-3 bg-white text-primary hover:bg-white/90" onClick={bildirimAc}><BellRing /> Bildirimleri aç</Button>
        </div>
      )}

      <Bolum baslik="Bugünün dersleri" link={{ to: "/veli/program", ad: "Program" }}>
        {bugun.length === 0 ? (
          <Card><CardContent className="p-4 text-sm text-muted-foreground">Bugün ders yok.</CardContent></Card>
        ) : (
          <Card className="divide-y">
            {bugun.map((o) => {
              const y = d.yoklamalar[o.id]?.durumlar[cocuk.id];
              return (
                <div key={o.id} className="flex items-center gap-3 p-3">
                  <span className="h-10 w-1 rounded-full" style={{ background: ders(o.satir.dersId)?.renk }} />
                  <div className="flex-1">
                    <p className="font-medium">{dersAdi(o.satir.dersId)}</p>
                    <p className="text-xs text-muted-foreground">{o.bas}–{o.bit} · {personelAdi(d, o.satir.ogretmenId)}</p>
                  </div>
                  {o.iptal || o.tatil ? <Badge variant="secondary">İptal</Badge> : y ? <Badge variant={yoklamaRenk[y]}>{yoklamaAd[y]}</Badge> : null}
                </div>
              );
            })}
          </Card>
        )}
      </Bolum>

      {sonYoklama && (
        <Bolum baslik="Son yoklama" link={{ to: "/veli/yoklama", ad: "Tümü" }}>
          <Card><CardContent className="flex items-center justify-between p-4 text-sm">
            <div><p className="font-medium">{tarihKisa(sonYoklama.y.tarih)} · {dersAdi(d.program.find((p) => p.id === sonYoklama.y.satirId)?.dersId ?? "")}</p><p className="text-xs text-muted-foreground">Konu: {sonYoklama.y.konu || "—"}</p></div>
            <Badge variant={yoklamaRenk[sonYoklama.durum]}>{yoklamaAd[sonYoklama.durum]}</Badge>
          </CardContent></Card>
        </Bolum>
      )}

      {!ogrenciModu && (
        <Button variant="outline" className="h-12 justify-between" onClick={() => setIzinAcik(true)}>
          <span className="flex items-center gap-2"><CalendarDays className="size-4" /> “Yarın gelemeyecek” bildir</span>
          <ChevronRight className="size-4" />
        </Button>
      )}

      {moduller.odev && (
        <Bolum baslik={`Bekleyen ödevler (${odevler.length})`} link={{ to: "/veli/odevler", ad: "Tümü" }}>
          {odevler.slice(0, 3).map((o) => (
            <Card key={o.id}><CardContent className="p-3 text-sm">
              <p className="font-medium">{o.baslik}</p>
              <p className="text-xs text-muted-foreground">{dersAdi(o.dersId)} · teslim {tarihKisa(o.teslim)} ({gunFarki(BUGUN, o.teslim) === 0 ? "bugün" : `${gunFarki(BUGUN, o.teslim)} gün`})</p>
            </CardContent></Card>
          ))}
          {odevler.length === 0 && <p className="text-sm text-muted-foreground">Bekleyen ödev yok.</p>}
        </Bolum>
      )}

      {moduller.finans && !ogrenciModu && taksitler.length > 0 && (
        <Bolum baslik="Ödemeler" link={{ to: "/veli/odemeler", ad: "Detay" }}>
          <Card><CardContent className="flex items-center justify-between p-4 text-sm">
            <div><p className="text-xs text-muted-foreground">Yaklaşan taksit</p><p className="font-medium">{tl(taksitKalan(taksitler[0]))} · {tarihKisa(taksitler[0].vade)}</p></div>
            <div className="text-right"><p className="text-xs text-muted-foreground">Toplam kalan</p><p className="font-medium">{tl(taksitler.reduce((t, x) => t + taksitKalan(x), 0))}</p></div>
          </CardContent></Card>
        </Bolum>
      )}

      <Bolum baslik="Duyurular" link={{ to: "/veli/duyurular", ad: "Tümü" }}>
        {duyurular.map((du) => (
          <Card key={du.id}><CardContent className="p-3 text-sm"><p className="font-medium">{du.baslik}</p><p className="line-clamp-2 text-muted-foreground">{du.metin}</p></CardContent></Card>
        ))}
        {duyurular.length === 0 && <p className="text-sm text-muted-foreground">Duyuru yok.</p>}
      </Bolum>

      <Bolum baslik="Şubeniz">
        <Card><CardContent className="grid gap-2 p-4 text-sm">
          <p className="font-medium">{s.ad} · {grupEtiket(d, k.grupId)}</p>
          <a className="flex items-center gap-2 text-muted-foreground" href={`https://www.google.com/maps/search/${encodeURIComponent(s.adres)}`} target="_blank" rel="noreferrer"><MapPin className="size-4" /> {s.adres}</a>
          <a className="flex items-center gap-2 text-primary" href={`tel:${s.telefon.replace(/\s/g, "")}`}><Phone className="size-4" /> {s.telefon}</a>
        </CardContent></Card>
      </Bolum>
      {izinAcik && <IzinDialog onClose={() => setIzinAcik(false)} />}
    </div>
  );
}

function IzinDialog({ onClose }: { onClose: () => void }) {
  const d = useDb();
  const { cocuk, islem } = usePortal();
  const [tarih, setTarih] = React.useState(tarihEkle(BUGUN, 1));
  const [not, setNot] = React.useState("");
  const dersVar = oturumlar(d, tarih).some((o) => o.satir.grupId === aktifKayit(d, cocuk.id)?.grupId);
  const gonder = async () => {
    if (await islem("/api/veli/izin", { ogrenciId: cocuk.id, tarih, not: not.trim() }, "Bildiriminiz öğretmene iletildi; yoklamada “izinli” görünecek.")) onClose();
  };
  return (
    <Dialog open onClose={onClose} title="Gelemeyecek bildirimi" description={`${cocuk.ad} için öğretmene önceden bilgi verin.`} footer={<><Button variant="outline" onClick={onClose}>Vazgeç</Button><Button onClick={gonder} disabled={tarih < BUGUN}>Gönder</Button></>}>
      <Field label="Tarih"><Input type="date" min={BUGUN} value={tarih} onChange={(e) => setTarih(e.target.value)} /></Field>
      {!dersVar && <Alert tone="warning">Bu tarihte {iyelik(cocuk.ad)} dersi görünmüyor.</Alert>}
      <Field label="Açıklama (isteğe bağlı)"><Textarea value={not} onChange={(e) => setNot(e.target.value)} placeholder="Doktor randevusu" /></Field>
    </Dialog>
  );
}

function PortalProgram() {
  const d = useDb();
  const { cocuk } = usePortal();
  const k = aktifKayit(d, cocuk.id)!;
  const gunler = Array.from({ length: 14 }, (_, i) => tarihEkle(BUGUN, i));
  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-semibold">Ders programı</h1>
      <p className="-mt-2 text-sm text-muted-foreground">{grupEtiket(d, k.grupId)} · önümüzdeki 2 hafta</p>
      {gunler.map((t) => {
        const l = oturumlar(d, t).filter((o) => o.satir.grupId === k.grupId);
        if (!l.length) return null;
        return (
          <div key={t}>
            <p className={cn("mb-1.5 text-xs font-medium", t === BUGUN ? "text-primary" : "text-muted-foreground")}>{t === BUGUN ? "Bugün · " : ""}{tarihKisa(t)}</p>
            <Card className="divide-y">
              {l.map((o) => (
                <div key={o.id} className={cn("flex items-center gap-3 p-3 text-sm", (o.iptal || o.tatil) && "opacity-60")}>
                  <span className="w-12 text-xs tabular-nums text-muted-foreground">{o.bas}</span>
                  <span className="h-8 w-1 rounded-full" style={{ background: ders(o.satir.dersId)?.renk }} />
                  <div className="flex-1"><p className={cn("font-medium", (o.iptal || o.tatil) && "line-through")}>{dersAdi(o.satir.dersId)}</p><p className="text-xs text-muted-foreground">{personelAdi(d, o.satir.ogretmenId)} · {derslikAdi(o.satir.derslikId)}</p></div>
                  {o.tatil ? <Badge variant="secondary">{o.tatil.ad}</Badge> : o.iptal ? <Badge variant="danger">İptal</Badge> : null}
                </div>
              ))}
            </Card>
          </div>
        );
      })}
    </div>
  );
}

function PortalYoklama() {
  const d = useDb();
  const { cocuk } = usePortal();
  const l = ogrenciYoklamalari(d, cocuk.id);
  const gelmedi = l.filter((x) => x.durum === "gelmedi").length;
  const izinler = d.izinler.filter((i) => i.ogrenciId === cocuk.id && i.tarih >= BUGUN);
  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-semibold">Yoklama ve işlenen konular</h1>
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Ders" value={l.length} />
        <StatCard label="Gelmedi" value={gelmedi} tone={gelmedi ? "danger" : "default"} />
        <StatCard label="Devam" value={`%${l.length ? Math.round(((l.length - gelmedi) / l.length) * 100) : 100}`} tone="success" />
      </div>
      {izinler.map((i) => <Alert key={i.id} icon={<CalendarDays />}>{tarihKisa(i.tarih)} için izin bildirdiniz: {i.not}</Alert>)}
      <Card className="divide-y">
        {l.slice(0, 40).map(({ y, durum }) => (
          <div key={y.oturumId} className="flex items-center gap-3 p-3 text-sm">
            <div className="flex-1">
              <p className="font-medium">{dersAdi(d.program.find((p) => p.id === y.satirId)?.dersId ?? "")} <span className="text-xs font-normal text-muted-foreground">· {tarihKisa(y.tarih)}</span></p>
              <p className="text-xs text-muted-foreground">{y.konu || "—"}</p>
            </div>
            <Badge variant={yoklamaRenk[durum]}>{yoklamaAd[durum]}</Badge>
          </div>
        ))}
      </Card>
    </div>
  );
}

function PortalOdevler() {
  const d = useDb();
  const { moduller } = useApp();
  const { cocuk } = usePortal();
  if (!moduller.odev) return <Navigate to="/veli" replace />;
  const k = aktifKayit(d, cocuk.id)!;
  const l = d.odevler.filter((o) => o.grupId === k.grupId && (!o.ogrenciIds || o.ogrenciIds.includes(cocuk.id))).sort((a, b) => b.teslim.localeCompare(a.teslim));
  const rozet = { yapti: ["Yaptı", "success"], eksik: ["Eksik", "warning"], yapmadi: ["Yapmadı", "danger"] } as const;
  return (
    <div className="grid gap-3">
      <h1 className="text-xl font-semibold">Ödevler</h1>
      {l.map((o) => {
        const t = o.teslimler[cocuk.id];
        return (
          <Card key={o.id}><CardContent className="grid gap-1 p-4 text-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium">{o.baslik}</p>
              {t ? <Badge variant={rozet[t][1]}>{rozet[t][0]}</Badge> : o.teslim >= BUGUN ? <Badge>Teslim {tarihKisa(o.teslim)}</Badge> : <Badge variant="secondary">Kontrol bekliyor</Badge>}
            </div>
            <p className="text-xs" style={{ color: ders(o.dersId)?.renk }}>{dersAdi(o.dersId)} · {personelAdi(d, o.ogretmenId)}</p>
            <p className="text-muted-foreground">{o.aciklama}</p>
            {o.kaynak && <p className="text-xs">📎 {o.kaynak}</p>}
            {o.notlar[cocuk.id] && <p className="mt-1 rounded-md bg-muted p-2 text-xs">Öğretmen notu: {o.notlar[cocuk.id]}</p>}
          </CardContent></Card>
        );
      })}
      {l.length === 0 && <p className="text-sm text-muted-foreground">Ödev yok.</p>}
    </div>
  );
}

function PortalDuyurular() {
  const d = useDb();
  const { veli, islem } = usePortal();
  const l = d.duyurular.filter((du) => !du.zamanlanmis && du.aliciVeliIds.includes(veli.id)).sort((a, b) => b.zaman.localeCompare(a.zaman));
  // Ekran açıldığında okundu bilgisi yazılır
  React.useEffect(() => {
    const okunmamis = l.filter((du) => !du.okuyanVeliIds.includes(veli.id)).map((du) => du.id);
    if (okunmamis.length) void islem("/api/veli/okundu", { duyuruIds: okunmamis });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="grid gap-3">
      <h1 className="text-xl font-semibold">Duyurular</h1>
      {l.map((du) => (
        <Card key={du.id}><CardContent className="grid gap-1 p-4 text-sm">
          <div className="flex items-center justify-between gap-2"><p className="font-medium">{du.baslik}</p>{!du.okuyanVeliIds.includes(veli.id) && <span className="size-2 rounded-full bg-primary" />}</div>
          <p className="text-muted-foreground">{du.metin}</p>
          <p className="text-xs text-muted-foreground">{new Date(du.zaman).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })}</p>
        </CardContent></Card>
      ))}
      {l.length === 0 && <p className="text-sm text-muted-foreground">Duyuru yok.</p>}
    </div>
  );
}

function PortalEtut() {
  const d = useDb();
  const { moduller } = useApp();
  const { cocuk, islem } = usePortal();
  const [secim, setSecim] = React.useState<{ tarih: string; bas: string; bit: string; ogretmenId: string; subeId: string } | null>(null);
  if (!moduller.etut) return <Navigate to="/veli" replace />;
  const k = aktifKayit(d, cocuk.id)!;
  const randevular = d.randevular.filter((r) => r.ogrenciIds.includes(cocuk.id)).sort((a, b) => b.tarih.localeCompare(a.tarih));
  // Veli varsayılan olarak çocuğunun kayıtlı olduğu şubedeki slotları görür
  const gunler = Array.from({ length: 10 }, (_, i) => tarihEkle(BUGUN, i));
  const slotlar = gunler.flatMap((t) => bosSlotlar(d, t, undefined, k.subeId).map((s) => ({ ...s, tarih: t })));
  const iptalEdilebilir = (tarih: string, bas: string) => (new Date(`${tarih}T${bas}`).getTime() - new Date(simdiZaman()).getTime()) / 36e5 >= d.ayarlar.etutIptalSaat;

  const al = async () => {
    if (!secim) return;
    if (await islem("/api/veli/randevu", { ogrenciId: cocuk.id, ogretmenId: secim.ogretmenId, tarih: secim.tarih, bas: secim.bas }, "Randevunuz alındı. 1 saat önce hatırlatma gelecek.")) setSecim(null);
  };
  const iptal = (id: string) => void islem(`/api/veli/randevu/${id}/iptal`, {}, "Randevu iptal edildi.");

  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-semibold">Etüt randevuları</h1>
      <Bolum baslik="Randevularım">
        {randevular.length === 0 && <p className="text-sm text-muted-foreground">Randevu yok.</p>}
        {randevular.map((r) => (
          <Card key={r.id}><CardContent className="flex items-center gap-3 p-3 text-sm">
            <div className="flex-1"><p className="font-medium">{tarihKisa(r.tarih)} · {r.bas}</p><p className="text-xs text-muted-foreground">{personelAdi(d, r.ogretmenId)} · {etutTurAd[r.tur]} · {sube(r.subeId)?.ad}</p></div>
            {r.durum === "planli" && r.tarih >= BUGUN ? (
              iptalEdilebilir(r.tarih, r.bas) ? <Button size="sm" variant="ghost" className="text-danger" onClick={() => iptal(r.id)}>İptal</Button> : <span className="text-xs text-muted-foreground">İptal süresi geçti</span>
            ) : (
              <Badge variant={r.durum === "yapildi" ? "success" : r.durum === "iptal" ? "secondary" : r.durum === "gelmedi" ? "danger" : "default"}>{r.durum}</Badge>
            )}
          </CardContent></Card>
        ))}
      </Bolum>
      <Bolum baslik={`Boş saatler · ${sube(k.subeId)?.ad}`}>
        <div className="grid grid-cols-2 gap-2">
          {slotlar.slice(0, 16).map((s) => (
            <button key={`${s.tarih}${s.bas}${s.m.id}`} onClick={() => setSecim({ tarih: s.tarih, bas: s.bas, bit: s.bit, ogretmenId: s.m.ogretmenId, subeId: s.m.subeId })} className="rounded-lg border p-2.5 text-left text-sm hover:border-primary">
              <p className="font-medium">{gunKisa[haftaGunu(s.tarih)]} {s.bas}</p>
              <p className="text-xs text-muted-foreground">{personelAdi(d, s.m.ogretmenId)}</p>
            </button>
          ))}
        </div>
        {slotlar.length === 0 && <p className="text-sm text-muted-foreground">Önümüzdeki günlerde boş slot yok.</p>}
      </Bolum>
      {secim && (
        <Dialog open onClose={() => setSecim(null)} title="Randevuyu onayla" description={`${gunAdlari[haftaGunu(secim.tarih)]} ${tarihKisa(secim.tarih)} ${secim.bas}–${secim.bit} · ${personelAdi(d, secim.ogretmenId)}`} footer={<><Button variant="outline" onClick={() => setSecim(null)}>Vazgeç</Button><Button onClick={al}>Randevu al</Button></>}>
          <p className="text-sm text-muted-foreground">En geç {d.ayarlar.etutIptalSaat} saat öncesine kadar iptal edebilirsiniz.</p>
        </Dialog>
      )}
    </div>
  );
}

function PortalOdemeler() {
  const d = useDb();
  const { moduller } = useApp();
  const { cocuklar, ogrenciModu } = usePortal();
  if (!moduller.finans || ogrenciModu) return <Navigate to="/veli" replace />;
  // Kardeşlerin borçları veli bazında birlikte görünür
  const taksitler = d.taksitler.filter((t) => cocuklar.some((o) => o.id === t.ogrenciId)).sort((a, b) => a.vade.localeCompare(b.vade));
  const kalan = taksitler.reduce((s, t) => s + taksitKalan(t), 0);
  const geciken = taksitler.filter((t) => t.vade < BUGUN && taksitKalan(t) > 0).reduce((s, t) => s + taksitKalan(t), 0);
  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-semibold">Ödemeler</h1>
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Toplam kalan" value={tl(kalan)} />
        <StatCard label="Vadesi geçen" value={tl(geciken)} tone={geciken ? "danger" : "default"} />
      </div>
      <Button disabled title="v2: sanal POS (iyzico / PayTR)"><Wallet /> Online öde (yakında)</Button>
      <Card className="divide-y">
        {taksitler.map((t) => {
          const k = taksitKalan(t);
          return (
            <div key={t.id} className="flex items-center gap-3 p-3 text-sm">
              <div className="flex-1"><p className="font-medium">{cocuklar.length > 1 && `${cocuklar.find((o) => o.id === t.ogrenciId)?.ad} · `}{taksitAdi(t.no)}</p><p className="text-xs text-muted-foreground">Vade {tarihKisa(t.vade)}</p></div>
              <div className="text-right"><p className="tabular-nums">{tl(t.tutar)}</p>{k <= 0 ? <Badge variant="success">Ödendi</Badge> : t.vade < BUGUN ? <Badge variant="danger">Gecikti</Badge> : <Badge variant="secondary">Bekliyor</Badge>}</div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

function PortalOgretmenler() {
  const d = useDb();
  const { cocuk } = usePortal();
  const k = aktifKayit(d, cocuk.id)!;
  const g = grup(d, k.grupId)!;
  const ogretmenler = [...new Set(d.program.filter((p) => p.grupId === k.grupId && !p.bitis).map((p) => p.ogretmenId))];
  return (
    <div className="grid gap-3">
      <h1 className="text-xl font-semibold">Öğretmenler</h1>
      {ogretmenler.map((id) => {
        const p = d.personel.find((x) => x.id === id)!;
        const dersAdlari = [...new Set(d.program.filter((x) => x.grupId === k.grupId && x.ogretmenId === id).map((x) => dersAdi(x.dersId)))];
        return (
          <Card key={id}><CardContent className="flex items-center gap-3 p-3">
            <Avatar ad={tamAd(p)} />
            <div className="flex-1 text-sm"><p className="font-medium">{tamAd(p)} {g.rehberId === id && <Badge variant="outline" className="ml-1">Rehber</Badge>}</p><p className="text-xs text-muted-foreground">{dersAdlari.join(", ")}</p></div>
          </CardContent></Card>
        );
      })}
      <p className="text-xs text-muted-foreground">Öğretmenlerin kişisel numaraları paylaşılmaz. Mesajlaşma v2'de eklenecek; şimdilik şubeyi arayabilirsiniz.</p>
    </div>
  );
}

function PortalBildirimler() {
  const d = useDb();
  const { veli } = usePortal();
  const l = d.gonderimler.filter((g) => g.veliId === veli.id).sort((a, b) => b.zaman.localeCompare(a.zaman)).slice(0, 50);
  return (
    <div className="grid gap-3">
      <h1 className="text-xl font-semibold">Bildirimler</h1>
      {l.length === 0 && <p className="text-sm text-muted-foreground">Bildirim yok.</p>}
      <Card className="divide-y">
        {l.map((g) => (
          <div key={g.id} className="flex gap-3 p-3 text-sm">
            <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full", g.kanal === "sms" ? "bg-warning/10 text-warning" : "bg-accent text-accent-foreground")}>{g.kanal === "sms" ? <Phone className="size-4" /> : <Bell className="size-4" />}</span>
            <div><p>{g.metin}</p><p className="text-xs text-muted-foreground">{new Date(g.zaman).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })} · {g.kanal === "sms" ? "SMS" : "Uygulama"}</p></div>
          </div>
        ))}
      </Card>
    </div>
  );
}

function PortalProfil() {
  const d = useDb();
  const { dark, setDark } = useApp();
  const { veli, cocuklar, ogrenciModu, setOgrenciModu, cikis, islem } = usePortal();
  const navigate = useNavigate();
  const [talep, setTalep] = React.useState("");
  const izin = (p: Partial<Pick<Veli, "pushAcik" | "izinSms" | "izinTanitim">>) => void islem("/api/veli/tercih", p);
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
        <div className="flex items-center justify-between"><span>Uygulama bildirimleri</span><Switch label="Bildirimler" checked={veli.pushAcik} onCheckedChange={(v) => izin({ pushAcik: v })} /></div>
        <div className="flex items-center justify-between"><span>Bilgilendirme SMS'i</span><Switch label="SMS" checked={veli.izinSms} onCheckedChange={(v) => izin({ izinSms: v })} /></div>
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
