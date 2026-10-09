/**
 * Personel girişi (Bölüm 02): e-posta + parola, gerekiyorsa SMS koduyla iki adımlı doğrulama.
 * PersonelKapisi: oturum yoksa giriş sayfasına yönlendirir, varsa yetkiye göre süzülmüş veriyi yükler.
 */
import * as React from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { KeyRound, Loader2, LogIn, ShieldCheck } from "lucide-react";
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
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <span className="inline-flex items-center gap-2.5 text-lg font-semibold">
          <svg viewBox="0 0 32 32" className="size-8" aria-hidden><rect width="32" height="32" rx="8" fill="#fff" fillOpacity=".15" /><path d="M21.14 9.87A8 8 0 1 0 21.14 22.13" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" fill="none" /><circle cx="24.6" cy="16" r="2.6" fill="#fff" /></svg>
          Classmate
        </span>
        <div>
          <p className="text-3xl font-semibold leading-tight">Kayıt, yoklama, ders programı ve veli iletişimi tek yerde.</p>
          <p className="mt-3 max-w-md text-primary-foreground/80">{durum?.kurum ?? ""}</p>
        </div>
        <p className="text-sm text-primary-foreground/70">Veliler giriş için telefonlarından <b>/veli</b> adresini kullanır.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h1 className="text-2xl font-semibold tracking-tight">{iki ? "Doğrulama kodu" : "Personel girişi"}</h1>
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
