/**
 * Personel girişi (Bölüm 02): e-posta + parola, gerekiyorsa SMS koduyla iki adımlı doğrulama.
 * PersonelKapisi: oturum yoksa giriş sayfasına yönlendirir, varsa yetkiye göre süzülmüş veriyi yükler.
 */
import * as React from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { BellRing, CalendarDays, ClipboardCheck, KeyRound, Loader2, LogIn, ShieldCheck, Smartphone, Sparkles } from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/Logo";
import { Alert, Button, Card, CardContent, Dialog, Field, Input, toast } from "@/components/ui";
import { useApp, type BenBilgisi } from "@/context/AppContext";
import { rolAdlari, useVeriHazir, veriYukle, veriyiTemizle, type Rol } from "@/data/store";
import { api, ApiHatasi, type SunucuDurumu } from "@/lib/api";

export function useSunucuDurumu() {
  const [d, setD] = React.useState<SunucuDurumu | null>(null);
  React.useEffect(() => {
    api<SunucuDurumu>("/api/durum").then(setD).catch(() => setD(null));
  }, []);
  return d;
}

export function Yukleniyor({ metin = "Yükleniyor…" }: { metin?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
        <LogoMark className="size-10" />
        <span className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> {metin}</span>
      </div>
    </div>
  );
}

/** Giriş ekranının sol tarafı: uygulamanın ne yaptığını gösteren canlı tanıtım */
function TanitimAlani({ kurum }: { kurum?: string }) {
  const ozellikler = [
    { ikon: <ClipboardCheck />, baslik: "30 saniyede yoklama", metin: "Gelmeyen öğrencinin velisine anında bildirim." },
    { ikon: <CalendarDays />, baslik: "Akıllı ders programı", metin: "Öğretmen ve derslik çakışmalarını önceden yakalar." },
    { ikon: <Smartphone />, baslik: "Veli portalı", metin: "Uygulama indirmeden telefondan her şey." },
  ];
  return (
    <div className="relative hidden overflow-hidden bg-[#1a1240] p-12 text-white lg:flex lg:flex-col lg:justify-between">
      <span className="pointer-events-none absolute -left-24 -top-24 size-96 animate-yuzen rounded-full bg-primary/60 blur-3xl" />
      <span className="pointer-events-none absolute -bottom-32 right-0 size-[28rem] animate-yuzen rounded-full bg-fuchsia-500/40 blur-3xl [animation-delay:-5s]" />
      <span className="pointer-events-none absolute right-1/4 top-1/3 size-64 animate-yuzen rounded-full bg-sky-400/25 blur-3xl [animation-delay:-9s]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.08)_1px,transparent_1px)] [background-size:22px_22px]" />

      <span className="relative inline-flex items-center gap-2.5">
        <LogoMark className="size-9" />
        <span className="font-display text-xl font-extrabold">Classmate</span>
      </span>

      <div className="relative max-w-lg">
        <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur">
          <Sparkles className="size-3.5" /> {kurum ?? "Kurs yönetim sistemi"}
        </p>
        <h2 className="mt-5 text-[40px] font-extrabold leading-[1.1] tracking-tight">
          Kurumunuzun tüm işleri,{" "}
          <span className="bg-gradient-to-r from-sky-300 via-fuchsia-300 to-amber-200 bg-clip-text text-transparent">tek bir yerde.</span>
        </h2>
        <ul className="mt-8 grid gap-3">
          {ozellikler.map((o, i) => (
            <li
              key={o.baslik}
              style={{ animationDelay: `${150 + i * 120}ms` }}
              className="flex animate-giris items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.07] p-3 backdrop-blur"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/15 [&_svg]:size-5">{o.ikon}</span>
              <span>
                <span className="block text-sm font-bold">{o.baslik}</span>
                <span className="block text-sm text-white/70">{o.metin}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Örnek bildirim kartı */}
      <div className="relative flex animate-giris items-center gap-3 self-start rounded-2xl bg-white p-3 pr-5 text-[#14142b] shadow-2xl [animation-delay:600ms]">
        <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-400 text-white">
          <BellRing className="size-5" />
        </span>
        <span>
          <span className="block text-sm font-bold">Veliye bildirildi</span>
          <span className="block text-xs text-[#6b6b85]">Ayşe bugün 16:00 Matematik dersine katılmadı.</span>
        </span>
      </div>
    </div>
  );
}

export function GirisSayfasi() {
  const { setBen } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const durum = useSunucuDurumu();
  const [eposta, setEposta] = React.useState("");
  const [parola, setParola] = React.useState("");
  const [iki, setIki] = React.useState<{ gecici: string; telefon: string; demoKod?: string } | null>(null);
  const [kod, setKod] = React.useState("");
  const [hata, setHata] = React.useState("");
  const [bekliyor, setBekliyor] = React.useState(false);
  const hedef = (location.state as { hedef?: string } | null)?.hedef ?? "/";

  const tamamla = (b: BenBilgisi) => {
    setBen(b);
    navigate(hedef, { replace: true });
  };
  const gir = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setHata("");
    setBekliyor(true);
    try {
      const r = await api<BenBilgisi & { ikiAdim?: boolean; gecici: string; telefon: string; demoKod?: string }>("/api/giris", { eposta, parola });
      if (r.ikiAdim) setIki({ gecici: r.gecici, telefon: r.telefon, demoKod: r.demoKod });
      else tamamla(r);
    } catch (err) {
      setHata(err instanceof Error ? err.message : "Giriş yapılamadı.");
    } finally {
      setBekliyor(false);
    }
  };
  const dogrula = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!iki) return;
    setHata("");
    setBekliyor(true);
    try {
      tamamla(await api<BenBilgisi>("/api/giris/dogrula", { gecici: iki.gecici, kod }));
    } catch (err) {
      setHata(err instanceof Error ? err.message : "Doğrulanamadı.");
      if (err instanceof ApiHatasi && /Yeniden giriş/.test(err.message)) setIki(null);
    } finally {
      setBekliyor(false);
    }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <TanitimAlani kurum={durum?.kurum} />
      <div className="relative flex items-center justify-center p-6">
        <div className="aurora lg:hidden" aria-hidden />
        <div className="relative w-full max-w-sm animate-giris">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h1 className="text-[28px] font-extrabold tracking-tight">{iki ? "Doğrulama kodu" : "Tekrar hoş geldiniz"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{iki ? `${iki.telefon} numarasına gönderilen 6 haneli kodu girin.` : "Kurum e-posta adresiniz ve parolanızla girin."}</p>
          {!iki ? (
            <form className="mt-6 grid gap-4" onSubmit={gir}>
              <Field label="E-posta"><Input type="email" autoComplete="username" autoFocus value={eposta} onChange={(e) => setEposta(e.target.value)} /></Field>
              <Field label="Parola"><Input type="password" autoComplete="current-password" value={parola} onChange={(e) => setParola(e.target.value)} /></Field>
              {hata && <p className="text-sm text-danger" role="alert">{hata}</p>}
              <Button type="submit" disabled={!eposta || !parola || bekliyor}>{bekliyor ? <Loader2 className="animate-spin" /> : <LogIn />} Giriş yap</Button>
            </form>
          ) : (
            <form className="mt-6 grid gap-4" onSubmit={dogrula}>
              <Input inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6} className="h-12 text-center font-mono text-xl tracking-[0.5em]" value={kod} onChange={(e) => setKod(e.target.value.replace(/\D/g, ""))} />
              {iki.demoKod && <p className="text-xs text-muted-foreground">Demo (SMS konsola yazıldı): <b className="font-mono">{iki.demoKod}</b></p>}
              {hata && <p className="text-sm text-danger" role="alert">{hata}</p>}
              <Button type="submit" disabled={kod.length !== 6 || bekliyor}><ShieldCheck /> Doğrula</Button>
              <Button type="button" variant="ghost" onClick={() => { setIki(null); setKod(""); setHata(""); }}>Geri</Button>
            </form>
          )}
          {durum?.demo && !iki && (
            <Card className="mt-8 border-dashed">
              <CardContent className="grid gap-1 p-3">
                <p className="mb-1 text-xs text-muted-foreground">Demo hesapları · parola <b className="font-mono">{durum.demoParola}</b></p>
                {durum.demoHesaplar?.map((h) => (
                  <button key={h.eposta} type="button" onClick={() => { setEposta(h.eposta); setParola(durum.demoParola ?? ""); }} className="flex items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted">
                    <span>{h.ad}</span>
                    <span className="text-xs text-muted-foreground">{rolAdlari[h.rol as Rol]}</span>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

/** Oturum gerektiren yönetim alanının kapısı */
export function PersonelKapisi({ children }: { children: React.ReactNode }) {
  const { ben, setBen } = useApp();
  const hazir = useVeriHazir();
  const location = useLocation();
  const [durum, setDurum] = React.useState<"bekliyor" | "giris" | "hazir" | "hata">(ben ? "bekliyor" : "bekliyor");
  const [hata, setHata] = React.useState("");

  React.useEffect(() => {
    let iptal = false;
    (async () => {
      try {
        const b = ben ?? (await api<BenBilgisi>("/api/ben"));
        if (iptal) return;
        if (!ben) setBen(b);
        await veriYukle("personel");
        if (!iptal) setDurum("hazir");
      } catch (e) {
        if (iptal) return;
        if (e instanceof ApiHatasi && e.durum === 401) setDurum("giris");
        else {
          setHata(e instanceof Error ? e.message : "Veri yüklenemedi.");
          setDurum("hata");
        }
      }
    })();
    return () => {
      iptal = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ben?.kullanici.id]);

  if (durum === "giris") return <Navigate to="/giris" replace state={{ hedef: location.pathname + location.search }} />;
  if (durum === "hata")
    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <Alert tone="danger">{hata} <button className="ml-2 underline" onClick={() => window.location.reload()}>Tekrar dene</button></Alert>
      </div>
    );
  if (durum !== "hazir" || !hazir || !ben) return <Yukleniyor metin="Veriler yükleniyor…" />;
  return (
    <>
      {children}
      {ben.parolaDegistirmeli && <ParolaDegistir zorunlu onClose={() => setBen({ ...ben, parolaDegistirmeli: false })} />}
    </>
  );
}

export async function cikisYap(setBen: (b: BenBilgisi | null) => void) {
  await api("/api/cikis", {}).catch(() => undefined);
  setBen(null);
  veriyiTemizle();
  window.location.assign("/giris");
}

export function ParolaDegistir({ onClose, zorunlu }: { onClose: () => void; zorunlu?: boolean }) {
  const [f, setF] = React.useState({ eski: "", yeni: "", tekrar: "" });
  const [hata, setHata] = React.useState("");
  const gecerli = f.yeni.length >= 8 && /\d/.test(f.yeni) && /\D/.test(f.yeni) && f.yeni === f.tekrar;
  const kaydet = async () => {
    setHata("");
    try {
      await api("/api/parola", { eski: f.eski, yeni: f.yeni });
      toast("Parolanız değiştirildi.");
      onClose();
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Parola değiştirilemedi.");
    }
  };
  return (
    <Dialog
      open
      onClose={zorunlu ? () => undefined : onClose}
      title={zorunlu ? "Yeni parola belirleyin" : "Parola değiştir"}
      description={zorunlu ? "Hesabınız geçici parolayla açıldı. Devam etmek için kendi parolanızı belirleyin." : undefined}
      footer={
        <>
          {!zorunlu && <Button variant="outline" onClick={onClose}>Vazgeç</Button>}
          <Button onClick={kaydet} disabled={!gecerli || !f.eski}><KeyRound /> Kaydet</Button>
        </>
      }
    >
      <Field label={zorunlu ? "Geçici parola" : "Mevcut parola"}><Input type="password" autoComplete="current-password" value={f.eski} onChange={(e) => setF({ ...f, eski: e.target.value })} /></Field>
      <Field label="Yeni parola" hint="En az 8 karakter; harf ve rakam içermeli."><Input type="password" autoComplete="new-password" value={f.yeni} onChange={(e) => setF({ ...f, yeni: e.target.value })} /></Field>
      <Field label="Yeni parola (tekrar)" hint={f.tekrar && f.tekrar !== f.yeni ? "Parolalar eşleşmiyor." : undefined}>
        <Input type="password" autoComplete="new-password" value={f.tekrar} onChange={(e) => setF({ ...f, tekrar: e.target.value })} />
      </Field>
      {hata && <p className="text-sm text-danger" role="alert">{hata}</p>}
    </Dialog>
  );
}
