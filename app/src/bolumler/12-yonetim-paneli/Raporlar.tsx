/** Bölüm 12 · Raporlar sekmesi: önizleme, CSV ve yazdırma aynı süzülmüş satırları kullanır. */
import * as React from "react";
import { Download, Printer } from "lucide-react";
import { Alert, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, Field, Input, Table, Td, Th, toast } from "@/components/ui";
import { useApp, useOturum } from "@/context/AppContext";
import { AKTIF_SEZON, BUGUN, useDb } from "@/data/store";
import { dosyaIndir, esc, yazdir } from "@/lib/yazdir";
import { cn } from "@/lib/utils";
import { aralikGecerli } from "./kurallar";
import { raporCsv, raporListesi } from "./raporTanimlari";

export function Raporlar() {
  const d = useDb();
  const { moduller } = useApp();
  const { subeGorunur, seciliSubeler, kapsam, rol, yetki } = useOturum();
  const liste = raporListesi(moduller, rol, yetki);
  const [secili, setSecili] = React.useState(liste[0]?.key ?? "");
  const [grupla, setGrupla] = React.useState(false);
  const [bas, setBas] = React.useState("");
  const [bit, setBit] = React.useState("");
  const rapor = liste.find((r) => r.key === secili) ?? liste[0];
  const subeAnahtari = seciliSubeler.join(",");
  const merkezDahil = rol === "genel-yonetici" && seciliSubeler.length === kapsam.length;
  const aralikVar = !!rapor?.tarihAraligi;
  const aralikBas = aralikVar ? bas : "";
  const aralikBit = aralikVar ? bit : "";
  const aralikHatali = !aralikGecerli(aralikBas, aralikBit);
  const sonuc = React.useMemo(() => {
    if (!rapor) return null;
    const s = rapor.uret(d, { sg: subeGorunur, sezonId: AKTIF_SEZON, bugun: BUGUN, merkezDahil, bas: aralikBas, bit: aralikBit });
    if (grupla) s.satirlar = [...s.satirlar].sort((a, b) => String(a[s.subeSutun]).localeCompare(String(b[s.subeSutun]), "tr"));
    return s;
    // subeGorunur her render'da yeni; seçili şubeler anahtarıyla izlenir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rapor, d, subeAnahtari, merkezDahil, grupla, BUGUN, aralikBas, aralikBit]);

  if (!rapor || !sonuc) return <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Yetkinize açık rapor yok.</CardContent></Card>;

  const aralikMetni = aralikBas || aralikBit ? `${aralikBas || "…"} – ${aralikBit || "…"}` : "";
  const csv = () => dosyaIndir(`${rapor.key}-${aralikMetni ? `${aralikBas || "bas"}_${aralikBit || "son"}` : BUGUN}.csv`, raporCsv(sonuc));
  const pdf = () => {
    const ok = yazdir(
      rapor.ad,
      `<h1>${esc(rapor.ad)}</h1><p class="kucuk">${BUGUN}${aralikMetni ? ` · Aralık: ${esc(aralikMetni)}` : ""} · ${sonuc.satirlar.length} satır</p>
       <table><tr>${sonuc.basliklar.map((b) => `<th>${esc(b)}</th>`).join("")}</tr>
       ${sonuc.satirlar.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table>`,
    );
    if (!ok) toast("Yazdırma penceresi açılamadı; açılır pencere iznini kontrol edin.", "hata");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <Card className="self-start">
        <CardContent className="grid gap-1 p-2">
          {liste.map((r) => (
            <button key={r.key} onClick={() => setSecili(r.key)} className={cn("flex items-center justify-between rounded-md px-3 py-2 text-left text-sm", r.key === rapor.key ? "bg-accent font-medium text-accent-foreground" : "hover:bg-muted")}>
              {r.ad}
              <span className="font-mono text-[10px] text-muted-foreground">{r.bolum}</span>
            </button>
          ))}
        </CardContent>
      </Card>
      <Card className="min-w-0">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">{rapor.ad}</CardTitle>
            <CardDescription className="mt-1">{sonuc.satirlar.length} satır · şube seçicisine göre filtrelenir</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Checkbox checked={grupla} onChange={setGrupla} label="Şubeye göre grupla" />
            <Button variant="outline" size="sm" onClick={csv} disabled={aralikHatali}><Download /> Excel (CSV)</Button>
            <Button variant="outline" size="sm" onClick={pdf} disabled={aralikHatali}><Printer /> PDF</Button>
          </div>
        </CardHeader>
        {aralikVar && (
          <CardContent className="grid gap-3 pt-0">
            <div className="flex flex-wrap gap-3">
              <Field label="Başlangıç"><Input type="date" value={bas} max={bit || undefined} onChange={(e) => setBas(e.target.value)} /></Field>
              <Field label="Bitiş"><Input type="date" value={bit} min={bas || undefined} onChange={(e) => setBit(e.target.value)} /></Field>
            </div>
            {aralikHatali && <Alert tone="danger">Başlangıç tarihi bitiş tarihinden sonra olamaz.</Alert>}
          </CardContent>
        )}
        <Table>
          <thead><tr>{sonuc.basliklar.map((b) => <Th key={b}>{b}</Th>)}</tr></thead>
          <tbody>
            {sonuc.satirlar.slice(0, 25).map((r, i) => (
              <tr key={i}>{r.map((c, j) => <Td key={j} className={cn(typeof c === "number" && "text-right tabular-nums")}>{c}</Td>)}</tr>
            ))}
          </tbody>
        </Table>
        {sonuc.satirlar.length > 25 && <p className="p-3 text-center text-xs text-muted-foreground">Önizlemede ilk 25 satır; indirilen dosyada tümü var.</p>}
        {sonuc.satirlar.length === 0 && !aralikHatali && <p className="p-6 text-center text-sm text-muted-foreground">Kayıt yok.</p>}
      </Card>
    </div>
  );
}
