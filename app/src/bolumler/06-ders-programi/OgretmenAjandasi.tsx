import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { gunAdlari } from "@/data/mock";
import { BUGUN, ders, derslikAdi, grupEtiket, oturumlar, personelAdi, saat, sube, useDb } from "@/data/store";
import { dakika, subeGecisUyarisi, tarihEkle } from "@/lib/kurallar";
import { cn } from "@/lib/utils";
import { tarihKisa } from "./ortak";
import { haftaSatirlari, satirGecerliMi, satirSlotu } from "./kurallar";

export function OgretmenAjandasi({ ogretmenId, hafta }: { ogretmenId: string; hafta: string }) {
  const d = useDb();
  const gunler = [1, 2, 3, 4, 5, 6, 7];
  const toplamDk = haftaSatirlari(d.program, hafta).filter((p) => p.ogretmenId === ogretmenId && saat(p.saatId)).reduce((s, p) => s + dakika(saat(p.saatId)!.bitis) - dakika(saat(p.saatId)!.baslangic), 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{personelAdi(d, ogretmenId)}</CardTitle>
        <CardDescription>Tüm şubeler birlikte · haftalık {Math.round(toplamDk / 40)} ders ({Math.round((toplamDk / 60) * 10) / 10} saat)</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {gunler.map((g) => {
          const t = tarihEkle(hafta, g - 1);
          const liste = oturumlar(d, t).filter((o) => o.satir.ogretmenId === ogretmenId);
          const slotlar = liste.map((o) => satirSlotu(d, o.satir)!);
          // Şube müdürü: diğer şubelerdeki dersler ayrıntısız (karar 2026-11-08)
          const dolu = (d.doluSaatler ?? []).filter((s) => s.ogretmenId === ogretmenId && s.gun === g && satirGecerliMi(s, t)).sort((a, b) => dakika(a.bas) - dakika(b.bas));
          return (
            <div key={g} className={cn("rounded-lg border p-2", t === BUGUN && "border-primary/50 bg-accent/30")}>
              <p className="mb-2 text-xs font-medium text-muted-foreground">{gunAdlari[g]} · {tarihKisa(t)}</p>
              <div className="grid gap-1.5">
                {liste.length === 0 && dolu.length === 0 && <p className="py-2 text-center text-xs text-muted-foreground">—</p>}
                {dolu.map((s) => (
                  <div key={s.bas + s.baslangic} className="rounded-md border border-dashed p-1.5 text-xs text-muted-foreground">
                    <p className="font-medium tabular-nums">{s.bas}–{s.bit}</p>
                    <p>Dolu</p>
                  </div>
                ))}
                {liste.map((o, i) => {
                  const ds = ders(o.satir.dersId)!;
                  const gecis = subeGecisUyarisi(slotlar[i], slotlar, d.ayarlar.subeGecisDk).length > 0;
                  return (
                    <div key={o.id} className={cn("rounded-md border-l-4 p-1.5 text-xs", (o.iptal || o.tatil) && "opacity-50 line-through")} style={{ borderLeftColor: ds.renk, background: `color-mix(in oklab, ${ds.renk} 10%, var(--color-card))` }}>
                      <p className="font-medium tabular-nums">{o.bas}–{o.bit}</p>
                      <p>{ds.ad} · {grupEtiket(d, o.satir.grupId)}</p>
                      <p className="text-muted-foreground">{sube(o.subeId)?.ad} · {derslikAdi(o.satir.derslikId)}</p>
                      {gecis && <p className="mt-0.5 flex items-center gap-1 text-warning"><AlertTriangle className="size-3" /> Şube geçişi kısa</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
