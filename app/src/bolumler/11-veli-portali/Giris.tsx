/** Veli girişi: telefon + SMS kodu */
import * as React from "react";
import { LogoMark } from "@/components/brand/Logo";
import { YapimciBilgisi } from "@/components/brand/Yapimci";
import { Button, Field, Input } from "@/components/ui";
import { telefonNormalize } from "@/lib/kurallar";
import { api } from "@/lib/api";
import { useSunucuDurumu } from "@/layout/Giris";

export function PortalGiris({ onGiris }: { onGiris: () => void }) {
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
                  <button type="button" key={v.telefon} onClick={() => setTel(v.telefon)} className="flex items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted">
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
          <Field label="SMS kodu"><Input inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6} className="h-12 text-center font-mono text-xl tracking-[0.5em]" value={kod} onChange={(e) => setKod(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => e.key === "Enter" && kod.length === 6 && void dogrula()} /></Field>
          {demoKod && <p className="text-xs text-muted-foreground">Demo (SMS konsola yazıldı): <b className="font-mono">{demoKod}</b></p>}
          {hata && <p className="text-sm text-danger" role="alert">{hata}</p>}
          <Button className="h-12 text-base" onClick={() => void dogrula()} disabled={kod.length !== 6 || bekliyor}>Giriş yap</Button>
          <Button variant="ghost" onClick={() => { setAdim("tel"); setKod(""); setHata(""); }}>Numarayı değiştir</Button>
          <p className="text-center text-xs text-muted-foreground">Bu cihazda {durum ? "uzun süre" : ""} oturum açık kalır; ortak cihazda çıkış yapmayı unutmayın.</p>
        </div>
      )}
      <YapimciBilgisi />
    </div>
  );
}
