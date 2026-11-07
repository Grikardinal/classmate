/** Raporlar: kaynağa ve şubeye göre dönüşüm, vazgeçme nedenleri dağılımı */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { sube, type Aday } from "@/data/store";
import { VAZGECME_NEDENLERI, donusumGrupla } from "./kurallar";

function OranCubugu({ etiket, toplam, kayit }: { etiket: string; toplam: number; kayit: number }) {
  const oran = toplam ? kayit / toplam : 0;
  return (
    <div className="grid grid-cols-[7rem_1fr_6rem] items-center gap-3 text-sm">
      <span className="truncate">{etiket}</span>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${oran * 100}%` }} />
      </div>
      <span className="text-right tabular-nums text-muted-foreground">
        {kayit}/{toplam} · %{Math.round(oran * 100)}
      </span>
    </div>
  );
}

export function AdayRaporlari({ adaylar }: { adaylar: Aday[] }) {
  const vazgecen = adaylar.filter((a) => a.durum === "vazgecti");
  // Listede olmayan (eski/serbest) nedenler "Diğer" altında sayılır
  const nedenler = VAZGECME_NEDENLERI.map(
    (n) => [n, vazgecen.filter((a) => (VAZGECME_NEDENLERI.includes(a.vazgecmeNedeni ?? "") ? a.vazgecmeNedeni : "Diğer") === n).length] as const,
  ).filter(([, c]) => c > 0);
  const enCok = Math.max(1, ...nedenler.map(([, c]) => c));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kaynağa göre dönüşüm</CardTitle>
          <CardDescription>Kayıt olan / toplam aday</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {donusumGrupla(adaylar, (a) => a.kaynak).map(([k, v]) => (
            <OranCubugu key={k} etiket={k} {...v} />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Şubeye göre dönüşüm</CardTitle>
          <CardDescription>Adayı takip eden şube</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {donusumGrupla(adaylar, (a) => sube(a.subeId)?.ad ?? "—").map(([k, v]) => (
            <OranCubugu key={k} etiket={k} {...v} />
          ))}
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Vazgeçme nedenleri</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {nedenler.length === 0 && <p className="text-sm text-muted-foreground">Vazgeçen aday yok.</p>}
          {nedenler.map(([n, c]) => (
            <div key={n} className="grid grid-cols-[7rem_1fr_2rem] items-center gap-3 text-sm">
              <span>{n}</span>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-danger/70" style={{ width: `${(c / enCok) * 100}%` }} />
              </div>
              <span className="text-right tabular-nums">{c}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
